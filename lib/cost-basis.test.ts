import {
    matchTransactionsFIFO,
    validateHistory,
    getMatchesForYear,
    getConsumedBuysForYear,
    calculateTaxYearSummary,
} from "./cost-basis"
import { Order, FundTransactions } from "./revolut-parser"

// Helper to create Order objects
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
    isin?: string
): FundTransactions {
    return {
        currency,
        isin,
        orders,
        interest_payments: [],
    }
}

describe("matchTransactionsFIFO", () => {
    it("should match a single SELL to a single BUY", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100),
            createOrder("SELL", "2024-03-20", 100),
        ]

        const result = matchTransactionsFIFO(orders)

        // Should have matches for 2024
        const matches2024 = result.matchesByYear.get(2024)
        expect(matches2024).toBeDefined()
        expect(matches2024).toHaveLength(1)
        expect(matches2024![0].sell.quantity).toBe(100)
        expect(matches2024![0].matches).toHaveLength(1)
        expect(matches2024![0].matches[0].quantityUsed).toBe(100)

        // Final inventory should be 0
        expect(result.finalInventory).toBe(0)
        expect(result.remainingLots).toHaveLength(0)
    })

    it("should use FIFO order - oldest BUY consumed first", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100, 1.0), // Oldest
            createOrder("BUY", "2023-06-15", 50, 1.02), // Newer
            createOrder("SELL", "2024-03-20", 120),
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = result.matchesByYear.get(2024)!

        expect(matches2024).toHaveLength(1)
        const sellMatch = matches2024[0]

        // Should consume 100 from first BUY, 20 from second BUY
        expect(sellMatch.matches).toHaveLength(2)
        expect(sellMatch.matches[0].quantityUsed).toBe(100) // First BUY fully consumed
        expect(sellMatch.matches[0].buy.date.toISOString()).toContain(
            "2023-01-15"
        )
        expect(sellMatch.matches[1].quantityUsed).toBe(20) // Partial from second BUY
        expect(sellMatch.matches[1].buy.date.toISOString()).toContain(
            "2023-06-15"
        )

        // Remaining inventory: 50 - 20 = 30 from the second BUY
        expect(result.remainingLots).toHaveLength(1)
        expect(result.remainingLots[0].remainingQuantity).toBe(30)
    })

    it("should handle multiple SELLs consuming multiple BUYs", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100),
            createOrder("BUY", "2023-06-15", 50),
            createOrder("SELL", "2024-03-20", 80),
            createOrder("SELL", "2024-09-10", 70),
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = result.matchesByYear.get(2024)!

        expect(matches2024).toHaveLength(2)

        // First SELL (80): consumes 80 from first BUY (20 remaining)
        expect(matches2024[0].sell.quantity).toBe(80)
        expect(matches2024[0].matches).toHaveLength(1)
        expect(matches2024[0].matches[0].quantityUsed).toBe(80)

        // Second SELL (70): consumes 20 from first BUY + 50 from second BUY
        expect(matches2024[1].sell.quantity).toBe(70)
        expect(matches2024[1].matches).toHaveLength(2)
        expect(matches2024[1].matches[0].quantityUsed).toBe(20) // Remaining from first BUY
        expect(matches2024[1].matches[1].quantityUsed).toBe(50) // All of second BUY

        // Final inventory: 0
        expect(result.finalInventory).toBe(0)
    })

    it("should handle BUYs and SELLs in mixed chronological order", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 50),
            createOrder("SELL", "2023-06-15", 30), // SELL in 2023
            createOrder("BUY", "2023-09-15", 100),
            createOrder("SELL", "2024-03-20", 80), // SELL in 2024
        ]

        const result = matchTransactionsFIFO(orders)

        // 2023 SELL: consumes 30 from first BUY
        const matches2023 = result.matchesByYear.get(2023)!
        expect(matches2023).toHaveLength(1)
        expect(matches2023[0].matches[0].quantityUsed).toBe(30)

        // 2024 SELL: consumes 20 (remaining from first BUY) + 60 from second BUY
        const matches2024 = result.matchesByYear.get(2024)!
        expect(matches2024).toHaveLength(1)
        expect(matches2024[0].matches).toHaveLength(2)
        expect(matches2024[0].matches[0].quantityUsed).toBe(20)
        expect(matches2024[0].matches[1].quantityUsed).toBe(60)

        // Remaining: 100 - 60 = 40
        expect(result.remainingLots[0].remainingQuantity).toBe(40)
    })

    it("should return empty matches when no SELLs", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100),
            createOrder("BUY", "2023-06-15", 50),
        ]

        const result = matchTransactionsFIFO(orders)

        expect(result.matchesByYear.size).toBe(0)
        expect(result.remainingLots).toHaveLength(2)
        expect(result.finalInventory).toBe(150)
    })

    it("should handle SELL larger than available BUYs (deficit scenario)", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 50),
            createOrder("SELL", "2024-03-20", 100), // Selling more than we have
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = result.matchesByYear.get(2024)!

        // Only matches 50 (all available BUYs)
        expect(matches2024[0].matches).toHaveLength(1)
        expect(matches2024[0].matches[0].quantityUsed).toBe(50)

        // No remaining lots
        expect(result.remainingLots).toHaveLength(0)
    })
})

describe("validateHistory", () => {
    it("should return complete when BUYs cover all SELLs", () => {
        const funds = [
            createFund("EUR", [
                createOrder("BUY", "2023-01-15", 100),
                createOrder("SELL", "2024-03-20", 80),
            ]),
        ]

        const result = validateHistory(funds)

        expect(result.isComplete).toBe(true)
        expect(result.deficit).toBeUndefined()
    })

    it("should return incomplete when SELL exceeds available BUYs", () => {
        const funds = [
            createFund("EUR", [
                createOrder("BUY", "2023-06-15", 50),
                createOrder("SELL", "2024-03-20", 100), // Deficit of 50
            ]),
        ]

        const result = validateHistory(funds)

        expect(result.isComplete).toBe(false)
        expect(result.deficit).toBeDefined()
        expect(result.deficit!.currency).toBe("EUR")
        expect(result.deficit!.unmatchedQuantity).toBeCloseTo(50, 1)
    })

    it("should detect deficit when SELL comes before BUY chronologically", () => {
        const funds = [
            createFund("EUR", [
                createOrder("SELL", "2024-01-15", 100), // SELL before any BUY
                createOrder("BUY", "2024-03-20", 100),
            ]),
        ]

        const result = validateHistory(funds)

        expect(result.isComplete).toBe(false)
        expect(result.deficit!.sellDate.toISOString()).toContain("2024-01-15")
    })

    it("should validate multiple funds independently", () => {
        const funds = [
            createFund("EUR", [
                createOrder("BUY", "2023-01-15", 100),
                createOrder("SELL", "2024-03-20", 80),
            ]),
            createFund("GBP", [
                createOrder("SELL", "2024-03-20", 50), // No BUY - deficit
            ]),
        ]

        const result = validateHistory(funds)

        expect(result.isComplete).toBe(false)
        expect(result.deficit!.currency).toBe("GBP")
    })

    it("should return complete with no transactions", () => {
        const funds = [createFund("EUR", [])]

        const result = validateHistory(funds)

        expect(result.isComplete).toBe(true)
    })

    it("should return complete with only BUYs", () => {
        const funds = [
            createFund("EUR", [
                createOrder("BUY", "2023-01-15", 100),
                createOrder("BUY", "2023-06-15", 50),
            ]),
        ]

        const result = validateHistory(funds)

        expect(result.isComplete).toBe(true)
    })
})

describe("getMatchesForYear", () => {
    it("should return only matches for specified year", () => {
        const orders = [
            createOrder("BUY", "2022-01-15", 200),
            createOrder("SELL", "2023-06-15", 50),
            createOrder("SELL", "2024-03-20", 80),
            createOrder("SELL", "2024-09-10", 30),
        ]

        const result = matchTransactionsFIFO(orders)

        const matches2023 = getMatchesForYear(result, 2023)
        expect(matches2023).toHaveLength(1)
        expect(matches2023[0].sell.quantity).toBe(50)

        const matches2024 = getMatchesForYear(result, 2024)
        expect(matches2024).toHaveLength(2)

        const matches2022 = getMatchesForYear(result, 2022)
        expect(matches2022).toHaveLength(0)
    })
})

describe("getConsumedBuysForYear", () => {
    it("should aggregate BUYs consumed by tax year SELLs", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100, 1.0),
            createOrder("BUY", "2023-06-15", 50, 1.02),
            createOrder("SELL", "2024-03-20", 80),
            createOrder("SELL", "2024-09-10", 50),
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = getMatchesForYear(result, 2024)
        const consumedBuys = getConsumedBuysForYear(matches2024)

        // First SELL (80): consumes 80 from first BUY
        // Second SELL (50): consumes 20 from first BUY + 30 from second BUY
        // Total consumed from first BUY: 100
        // Total consumed from second BUY: 30

        expect(consumedBuys).toHaveLength(2)
        expect(consumedBuys[0].totalQuantityUsed).toBe(100)
        expect(consumedBuys[1].totalQuantityUsed).toBe(30)
    })

    it("should return empty array when no SELLs in year", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100),
            createOrder("SELL", "2023-06-15", 50),
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = getMatchesForYear(result, 2024)
        const consumedBuys = getConsumedBuysForYear(matches2024)

        expect(consumedBuys).toHaveLength(0)
    })
})

describe("calculateTaxYearSummary", () => {
    it("should calculate correct totals for matched transactions", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 100, 1.0),
            createOrder("BUY", "2023-06-15", 50, 1.0),
            createOrder("SELL", "2024-03-20", 80, 1.0),
            createOrder("SELL", "2024-09-10", 40, 1.0),
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = getMatchesForYear(result, 2024)
        const summary = calculateTaxYearSummary(matches2024)

        expect(summary.sellCount).toBe(2)
        expect(summary.totalSellQuantity).toBe(120)
        expect(summary.totalSellValueEur).toBe(120) // 120 * 1.0

        // BUYs consumed: 100 from first + 20 from second = 120
        expect(summary.totalBuyQuantity).toBe(120)
        expect(summary.totalBuyValueEur).toBe(120)
    })
})

describe("FIFO edge cases", () => {
    it("should handle very small quantities (floating point)", () => {
        const orders = [
            createOrder("BUY", "2023-01-15", 0.001),
            createOrder("SELL", "2024-03-20", 0.001),
        ]

        const result = matchTransactionsFIFO(orders)
        const matches2024 = result.matchesByYear.get(2024)!

        expect(matches2024[0].matches[0].quantityUsed).toBeCloseTo(0.001, 6)
        expect(result.finalInventory).toBeCloseTo(0, 6)
    })

    it("should handle same-day BUY and SELL", () => {
        const orders = [
            createOrder("BUY", "2024-03-20", 100),
            createOrder("SELL", "2024-03-20", 50),
        ]

        const result = matchTransactionsFIFO(orders)

        // BUY should come before SELL when sorted (same timestamp, BUY added first)
        expect(result.remainingLots[0].remainingQuantity).toBe(50)
    })

    it("should handle partial BUY consumption across multiple years", () => {
        const orders = [
            createOrder("BUY", "2022-01-15", 100),
            createOrder("SELL", "2023-06-15", 30), // Consumes 30, leaves 70
            createOrder("SELL", "2024-03-20", 50), // Consumes 50, leaves 20
            createOrder("SELL", "2025-01-10", 20), // Consumes remaining 20
        ]

        const result = matchTransactionsFIFO(orders)

        // Check that the same BUY is referenced across years
        const matches2023 = result.matchesByYear.get(2023)!
        const matches2024 = result.matchesByYear.get(2024)!
        const matches2025 = result.matchesByYear.get(2025)!

        expect(matches2023[0].matches[0].buy.date).toEqual(
            matches2024[0].matches[0].buy.date
        )
        expect(matches2024[0].matches[0].buy.date).toEqual(
            matches2025[0].matches[0].buy.date
        )

        // Total consumed should equal original BUY
        const totalConsumed =
            matches2023[0].matches[0].quantityUsed +
            matches2024[0].matches[0].quantityUsed +
            matches2025[0].matches[0].quantityUsed
        expect(totalConsumed).toBe(100)

        expect(result.finalInventory).toBe(0)
    })
})
