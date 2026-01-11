import {
    generateTaxOfficeXml,
    getAvailableTaxForms,
    generateDohKDVPFromMatches,
} from "./tax-generator"
import { FundTransactions, InterestPayment, Order } from "./revolut-parser"
import { MatchedSell } from "./cost-basis"

// Helper to create InterestPayment
function createInterestPayment(
    dateStr: string,
    amount: number,
    quantityInEur: number
): InterestPayment {
    return {
        date: new Date(dateStr),
        amount,
        currency: "EUR",
        quantityInEur,
    }
}

// Helper to create Order
function createOrder(
    type: "BUY" | "SELL",
    dateStr: string,
    quantity: number,
    pricePerUnitInEur: number = 1
): Order {
    return {
        type,
        date: new Date(dateStr),
        quantity,
        pricePerUnit: 1,
        currency: "EUR",
        pricePerUnitInEur,
    }
}

// Helper to create FundTransactions
function createFund(
    currency: string,
    orders: Order[],
    interestPayments: InterestPayment[],
    isin?: string
): FundTransactions {
    return {
        currency,
        isin,
        orders,
        interest_payments: interestPayments,
    }
}

describe("generateTaxOfficeXml", () => {
    it("should only include interest from the selected tax year", () => {
        const funds = [
            createFund(
                "EUR",
                [],
                [
                    createInterestPayment("2023-06-15", 50, 50), // Previous year
                    createInterestPayment("2024-03-20", 100, 100), // Tax year
                    createInterestPayment("2024-09-10", 75, 75), // Tax year
                ]
            ),
        ]

        const xml = generateTaxOfficeXml(funds, 2024, "12345678")

        // Should only include 2024 interest: 100 + 75 = 175
        expect(xml).toContain("<Value>175.00</Value>")
        expect(xml).toContain("<Period>2024</Period>")
    })

    it("should return zero when no interest in tax year", () => {
        const funds = [
            createFund(
                "EUR",
                [],
                [
                    createInterestPayment("2023-06-15", 50, 50), // Previous year
                    createInterestPayment("2023-09-10", 75, 75), // Previous year
                ]
            ),
        ]

        const xml = generateTaxOfficeXml(funds, 2024, "12345678")

        expect(xml).toContain("<Value>0.00</Value>")
    })

    it("should aggregate interest from multiple funds for tax year", () => {
        const funds = [
            createFund(
                "EUR",
                [],
                [
                    createInterestPayment("2024-03-20", 100, 100),
                    createInterestPayment("2023-06-15", 50, 50), // Should be excluded
                ]
            ),
            createFund(
                "GBP",
                [],
                [
                    createInterestPayment("2024-06-15", 80, 85), // GBP converted to EUR
                ]
            ),
        ]

        const xml = generateTaxOfficeXml(funds, 2024, "12345678")

        // Should include: 100 (EUR) + 85 (GBP in EUR) = 185
        expect(xml).toContain("<Value>185.00</Value>")
    })
})

describe("getAvailableTaxForms", () => {
    it("should return interest=true when tax year has interest", () => {
        const funds = [
            createFund(
                "EUR",
                [],
                [createInterestPayment("2024-03-20", 100, 100)]
            ),
        ]

        const result = getAvailableTaxForms(funds, 2024)

        expect(result.interest).toBe(true)
    })

    it("should return interest=false when no interest in tax year", () => {
        const funds = [
            createFund(
                "EUR",
                [],
                [
                    createInterestPayment("2023-03-20", 100, 100), // Wrong year
                ]
            ),
        ]

        const result = getAvailableTaxForms(funds, 2024)

        expect(result.interest).toBe(false)
    })

    it("should return interest=true when taxYear not specified (backward compat)", () => {
        const funds = [
            createFund(
                "EUR",
                [],
                [createInterestPayment("2023-03-20", 100, 100)]
            ),
        ]

        const result = getAvailableTaxForms(funds)

        expect(result.interest).toBe(true)
    })

    it("should return kdvp=true when orders exist", () => {
        const funds = [
            createFund("EUR", [createOrder("BUY", "2024-01-15", 100)], []),
        ]

        const result = getAvailableTaxForms(funds, 2024)

        expect(result.kdvp).toBe(true)
    })
})

describe("generateDohKDVPFromMatches", () => {
    it("should generate XML with correct Sale fields (F6, F7, F9, F10)", () => {
        const matchesByFund = new Map<string, MatchedSell[]>()
        const buy = createOrder("BUY", "2023-01-15", 100, 1.0)
        const sell = createOrder("SELL", "2024-03-20", 80, 1.0)

        matchesByFund.set("EUR", [
            {
                sell,
                matches: [{ buy, quantityUsed: 80 }],
            },
        ])

        const fundInfo = new Map<string, { isin?: string }>()
        fundInfo.set("EUR", { isin: "IE00B4L5Y983" })

        const xml = generateDohKDVPFromMatches(
            matchesByFund,
            fundInfo,
            2024,
            "12345678"
        )

        // Should NOT contain F8 field (not allowed in Sale)
        expect(xml).not.toContain("<F8>")
        // Should contain the ISIN
        expect(xml).toContain("<ISIN>IE00B4L5Y983</ISIN>")
        // Should contain purchase and sale sections
        expect(xml).toContain("<Purchase>")
        expect(xml).toContain("<Sale>")
        // Should contain the correct Sale fields
        expect(xml).toContain("<F6>")
        expect(xml).toContain("<F7>")
        expect(xml).toContain("<F9>")
        expect(xml).toContain("<F10>")
    })

    it("should return empty string when no matches", () => {
        const matchesByFund = new Map<string, MatchedSell[]>()
        const fundInfo = new Map<string, { isin?: string }>()

        const xml = generateDohKDVPFromMatches(
            matchesByFund,
            fundInfo,
            2024,
            "12345678"
        )

        expect(xml).toBe("")
    })
})
