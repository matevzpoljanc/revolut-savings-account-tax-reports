interface Order {
    type: "BUY" | "SELL"
    date: Date
    quantity: number
    pricePerUnit: number
    currency: string
    pricePerUnitInEur: number
}

interface InterestPayment {
    date: Date
    amount: number
    currency: string
    quantityInEur?: number
}

interface FundTransactions {
    currency: string
    isin?: string // Added ISIN field
    orders: Order[]
    interest_payments: InterestPayment[]
}

// The conversion rates JSON is expected to be an array of objects with a "date" and a "rates" mapping.
interface ConversionRateRow {
    date: string // e.g., "2025-02-27"
    rates: { [currency: string]: number }
}

function parseCurrencyFromHeader(header: string): string | null {
    // Extract the 3-letter currency code from a header like "Summary for Flexible Cash Funds - EUR"
    const match = header.match(/- ([A-Z]{3})/)
    return match ? match[1] : null
}

function cleanAmount(value: string): number {
    // Remove any characters that are not digits, a decimal point, or a minus sign
    return parseFloat(value.replace(/[^0-9\.-]+/g, ""))
}

function parseDate(dateStr: string): Date {
    // Convert the date string into a Date object (assumes the string is in a parseable format)
    return new Date(dateStr.trim())
}

function formatDate(date: Date): string {
    // Format date as "YYYY-MM-DD"
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${year}-${month}-${day}`
}

/**
 * Get the conversion rate for the given currency (other than EUR) on the specified date.
 * If no exact match is found in the conversionRates array, the most recent available rate is used.
 */
function getConversionRate(
    date: Date,
    currency: string,
    conversionRates: ConversionRateRow[]
): number {
    if (currency === "EUR") return 1
    const formatted = formatDate(date)
    let row = conversionRates.find((r) => r.date === formatted)
    if (row && row.rates[currency] && !isNaN(row.rates[currency])) {
        return row.rates[currency]
    }
    // Fallback: choose the most recent available rate for this currency.
    const available = conversionRates
        .filter((r) => r.rates[currency] && !isNaN(r.rates[currency]))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    return available.length ? available[0].rates[currency] : 1
}

/**
 * Parse the transaction data.
 * @param input - The array-of-arrays input data.
 */
export async function parseTransactions(
    input: string[][]
): Promise<FundTransactions[]> {
    // Load conversion rates
    const conversionRates = await loadConversionRates()

    const funds: FundTransactions[] = []
    let currentFund: FundTransactions | null = null
    let inTransactionSection = false

    // Regex to extract an ISIN: 2 letters, 9 alphanumerics, 1 digit.
    const isinRegex = /\b[A-Z]{2}[0-9A-Z]{9}[0-9]\b/

    for (let i = 0; i < input.length; i++) {
        const row = input[i]

        // If we have a one-item row that indicates a header (and is not an empty string)
        if (row.length === 1 && row[0].trim() !== "") {
            const text = row[0].trim()

            // If it is a summary header, update the current fund (even if we don't use the summary details)
            if (text.startsWith("Summary for Flexible Cash Funds")) {
                const curr = parseCurrencyFromHeader(text)
                if (curr) {
                    currentFund = funds.find((f) => f.currency === curr) || {
                        currency: curr,
                        orders: [],
                        interest_payments: [],
                    }
                    if (!funds.includes(currentFund)) {
                        funds.push(currentFund)
                    }
                }
                inTransactionSection = false
                continue
            }

            // If it is a transactions header, update the current fund and set the flag to process transactions.
            if (text.startsWith("Transactions for Flexible Cash Funds")) {
                const curr = parseCurrencyFromHeader(text)
                if (curr) {
                    currentFund = funds.find((f) => f.currency === curr) || {
                        currency: curr,
                        orders: [],
                        interest_payments: [],
                    }
                    if (!funds.includes(currentFund)) {
                        funds.push(currentFund)
                    }
                    inTransactionSection = true
                    // Skip the next header row (the column names row)
                    i++
                }
                continue
            }
        }

        // Process transaction rows in a transaction section
        if (inTransactionSection && currentFund && row.length >= 3) {
            const [dateStr, description, value] = row
            if (!dateStr || !description || !value) continue // skip incomplete rows

            // Parse the date into a Date object
            const date = parseDate(dateStr)
            const amount = cleanAmount(value)

            // Look up conversion rate for the current fund's currency on this date
            const rate = getConversionRate(
                date,
                currentFund.currency,
                conversionRates
            )

            // Try to extract ISIN from the description, if present.
            const isinMatch = description.match(isinRegex)
            if (isinMatch && !currentFund.isin) {
                currentFund.isin = isinMatch[0]
            }

            // Process orders (BUY or SELL)
            if (
                description.startsWith("BUY") ||
                description.startsWith("SELL")
            ) {
                const typeMatch = description.match(/^(BUY|SELL)/)
                if (typeMatch) {
                    const type = typeMatch[1] as "BUY" | "SELL"

                    // For the updated Order interface
                    const quantity = Math.abs(amount)
                    const pricePerUnit = 1 // Default price per unit
                    const pricePerUnitInEur = 1 / rate

                    currentFund.orders.push({
                        type,
                        date,
                        quantity,
                        pricePerUnit,
                        currency: currentFund.currency,
                        pricePerUnitInEur,
                    })
                }
            }
            // Process interest payments (only "Interest PAID" rows)
            else if (description.includes("Interest PAID")) {
                currentFund.interest_payments.push({
                    date,
                    amount,
                    currency: currentFund.currency,
                    quantityInEur: amount / rate,
                })
            }
            // Other types (fees, reinvestments, etc.) are ignored.
        }
    }

    return funds
}

/**
 * Load the conversion rates from an external JSON file.
 */
async function loadConversionRates(): Promise<ConversionRateRow[]> {
    try {
        const response = await fetch("/conversion-rates.json")
        if (!response.ok) {
            console.error(
                "Failed to load conversion rates:",
                response.statusText
            )
            return [] // Return empty array if fetch fails
        }
        return await response.json()
    } catch (error) {
        console.error("Error loading conversion rates:", error)
        return [] // Return empty array on error
    }
}

/**
 * Validation result for CSV file content.
 */
export interface ValidationResult {
    isValid: boolean
    error?: string
    details?: string
}

/**
 * Validate that the CSV content is a valid Revolut Consolidated Statement.
 * This should be called before parseTransactions to give users early feedback.
 *
 * @param input - The array-of-arrays input data from Papa Parse.
 * @returns ValidationResult indicating if the file is valid.
 */
export function validateRevolutCSV(input: string[][]): ValidationResult {
    if (!input || input.length === 0) {
        return {
            isValid: false,
            error: "Prazna datoteka",
            details:
                "Naložena datoteka ne vsebuje nobenih podatkov. Preverite, da ste pravilno izvozili izpisek iz Revolut aplikacije.",
        }
    }

    // Check if there's enough content (at least a few rows)
    if (input.length < 3) {
        return {
            isValid: false,
            error: "Premalo podatkov v datoteki",
            details:
                "Datoteka je prekratka in ne vsebuje dovolj podatkov za obdelavo. Preverite, da ste izvozili celoten 'Consolidated statement'.",
        }
    }

    // Look for Revolut-specific headers in the content
    let hasSummaryHeader = false
    let hasTransactionsHeader = false
    let hasFlexibleCashFunds = false

    for (const row of input) {
        if (row.length === 0) continue

        const text = row[0]?.trim() || ""
        const fullRowText = row.join(" ").trim()

        // Check for Flexible Cash Funds references (the key indicator)
        if (fullRowText.includes("Flexible Cash Funds")) {
            hasFlexibleCashFunds = true
        }

        // Check for Summary header
        if (text.startsWith("Summary for Flexible Cash Funds")) {
            hasSummaryHeader = true
        }

        // Check for Transactions header
        if (text.startsWith("Transactions for Flexible Cash Funds")) {
            hasTransactionsHeader = true
        }
    }

    // If no Flexible Cash Funds references at all, this is likely the wrong statement type
    if (!hasFlexibleCashFunds) {
        return {
            isValid: false,
            error: "Datoteka ne vsebuje podatkov o varčevalnem računu v pričakovani obliki",
            details:
                "Ta datoteka ne vsebuje podatkov o Revolut Savings (Flexible Cash Funds). Morda ste izvozili napačen tip izpiska. Uporabite 'Consolidated statement' in izberite filter 'Savings & funds'.",
        }
    }

    // If we have Flexible Cash Funds but no proper headers, the format might be corrupted
    if (!hasSummaryHeader && !hasTransactionsHeader) {
        return {
            isValid: false,
            error: "Nepopolna ali poškodovana datoteka",
            details:
                "Datoteka vsebuje omembe Flexible Cash Funds, vendar manjkajo pričakovani razdelki. Preverite, da ste izvozili celoten 'Consolidated statement' v Excel (CSV) formatu.",
        }
    }

    return { isValid: true }
}

/**
 * Check if a file has a valid CSV extension.
 *
 * @param fileName - The name of the file.
 * @returns true if the file has a .csv extension.
 */
export function isValidCSVFile(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".csv")
}

/**
 * Merges transactions from multiple CSV files.
 * Combines orders by currency/ISIN, deduplicates, and sorts by date.
 *
 * @param existing - Previously parsed transactions
 * @param newData - New transactions to merge in
 * @returns Merged FundTransactions array
 */
export function mergeTransactions(
    existing: FundTransactions[],
    newData: FundTransactions[]
): FundTransactions[] {
    const merged: FundTransactions[] = [...existing]

    for (const newFund of newData) {
        // Find existing fund with same currency (and ISIN if available)
        let existingFund = merged.find(
            (f) =>
                f.currency === newFund.currency &&
                ((!f.isin && !newFund.isin) || f.isin === newFund.isin)
        )

        if (!existingFund) {
            // No matching fund found, add as new
            merged.push({
                currency: newFund.currency,
                isin: newFund.isin,
                orders: [...newFund.orders],
                interest_payments: [...newFund.interest_payments],
            })
        } else {
            // Merge orders, deduplicating by date + type + quantity
            for (const order of newFund.orders) {
                const isDuplicate = existingFund.orders.some(
                    (o) =>
                        o.date.getTime() === order.date.getTime() &&
                        o.type === order.type &&
                        Math.abs(o.quantity - order.quantity) < 0.001
                )
                if (!isDuplicate) {
                    existingFund.orders.push(order)
                }
            }

            // Merge interest payments, deduplicating by date + amount
            for (const payment of newFund.interest_payments) {
                const isDuplicate = existingFund.interest_payments.some(
                    (p) =>
                        p.date.getTime() === payment.date.getTime() &&
                        Math.abs(p.amount - payment.amount) < 0.001
                )
                if (!isDuplicate) {
                    existingFund.interest_payments.push(payment)
                }
            }

            // Update ISIN if not set
            if (!existingFund.isin && newFund.isin) {
                existingFund.isin = newFund.isin
            }
        }
    }

    // Sort orders by date within each fund
    for (const fund of merged) {
        fund.orders.sort((a, b) => a.date.getTime() - b.date.getTime())
        fund.interest_payments.sort(
            (a, b) => a.date.getTime() - b.date.getTime()
        )
    }

    return merged
}

export type { Order, InterestPayment, FundTransactions, ConversionRateRow }
