import { Order, FundTransactions } from "./revolut-parser"

/**
 * Represents a BUY lot with remaining quantity that hasn't been consumed by SELLs yet.
 */
export interface BuyLot {
    buy: Order
    remainingQuantity: number // starts as buy.quantity, decreases as consumed
}

/**
 * Represents a SELL matched with the BUYs that cover it.
 */
export interface MatchedSell {
    sell: Order
    matches: {
        buy: Order
        quantityUsed: number // portion of this BUY consumed by this SELL
    }[]
}

/**
 * Result of FIFO matching across all transactions.
 */
export interface MatchingResult {
    // All matched sells grouped by year
    matchesByYear: Map<number, MatchedSell[]>
    // Remaining inventory (unconsumed BUYs)
    remainingLots: BuyLot[]
    // Final inventory value in EUR
    finalInventory: number
}

/**
 * Validation result for transaction history completeness.
 */
export interface HistoryValidation {
    isComplete: boolean
    // If incomplete, details about the first unmatched SELL
    deficit?: {
        currency: string
        isin?: string
        sellDate: Date
        unmatchedQuantity: number
        message: string
    }
}

/**
 * Performs FIFO (First In, First Out) matching of BUY and SELL orders.
 *
 * Algorithm:
 * 1. Sort ALL transactions by date (ascending)
 * 2. Maintain a queue of BuyLots (oldest first)
 * 3. For each transaction chronologically:
 *    - BUY: Add new BuyLot to end of queue
 *    - SELL: Consume from front of queue (oldest first)
 * 4. Track which BUYs are consumed by which SELLs
 *
 * @param allOrders Full history of orders, will be sorted by date
 * @returns MatchingResult with matches grouped by year and remaining inventory
 */
export function matchTransactionsFIFO(allOrders: Order[]): MatchingResult {
    // Sort all orders by date ascending
    const sortedOrders = [...allOrders].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
    )

    // Queue of available BUY lots (FIFO - oldest first)
    const buyQueue: BuyLot[] = []

    // All matched sells grouped by year
    const matchesByYear = new Map<number, MatchedSell[]>()

    for (const order of sortedOrders) {
        if (order.type === "BUY") {
            // Add new BUY to end of queue
            buyQueue.push({
                buy: order,
                remainingQuantity: order.quantity,
            })
        } else if (order.type === "SELL") {
            // Consume from front of queue (oldest BUYs first)
            let remainingToSell = order.quantity
            const matches: MatchedSell["matches"] = []

            while (remainingToSell > 0 && buyQueue.length > 0) {
                const oldestLot = buyQueue[0]

                if (oldestLot.remainingQuantity <= remainingToSell) {
                    // Consume entire lot
                    matches.push({
                        buy: oldestLot.buy,
                        quantityUsed: oldestLot.remainingQuantity,
                    })
                    remainingToSell -= oldestLot.remainingQuantity
                    buyQueue.shift() // Remove exhausted lot
                } else {
                    // Partially consume lot
                    matches.push({
                        buy: oldestLot.buy,
                        quantityUsed: remainingToSell,
                    })
                    oldestLot.remainingQuantity -= remainingToSell
                    remainingToSell = 0
                }
            }

            // Create matched sell record
            const matchedSell: MatchedSell = {
                sell: order,
                matches,
            }

            // Group by year
            const year = order.date.getFullYear()
            if (!matchesByYear.has(year)) {
                matchesByYear.set(year, [])
            }
            matchesByYear.get(year)!.push(matchedSell)
        }
    }

    // Calculate final inventory value
    const finalInventory = buyQueue.reduce((sum, lot) => {
        return sum + lot.remainingQuantity * lot.buy.pricePerUnitInEur
    }, 0)

    return {
        matchesByYear,
        remainingLots: buyQueue,
        finalInventory,
    }
}

/**
 * Validates that transaction history is complete.
 * History is complete when ALL SELLs can be fully matched with BUYs.
 *
 * @param funds Array of FundTransactions to validate
 * @returns HistoryValidation indicating if history is complete
 */
export function validateHistory(funds: FundTransactions[]): HistoryValidation {
    for (const fund of funds) {
        // Sort orders by date
        const sortedOrders = [...fund.orders].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
        )

        // Track available inventory
        let inventory = 0

        for (const order of sortedOrders) {
            if (order.type === "BUY") {
                inventory += order.quantity
            } else if (order.type === "SELL") {
                inventory -= order.quantity

                // If inventory goes negative, we have a deficit
                if (inventory < -0.001) {
                    // Small tolerance for floating point
                    const deficit = Math.abs(inventory)
                    return {
                        isComplete: false,
                        deficit: {
                            currency: fund.currency,
                            isin: fund.isin,
                            sellDate: order.date,
                            unmatchedQuantity: deficit,
                            message: `Manjkajo nakupi za ${deficit.toFixed(2)} ${fund.currency}. Potrebujete transakcije pred ${order.date.toISOString().split("T")[0]}.`,
                        },
                    }
                }
            }
        }
    }

    return { isComplete: true }
}

/**
 * Gets matched sells for a specific tax year.
 *
 * @param result MatchingResult from matchTransactionsFIFO
 * @param taxYear The tax year to get matches for
 * @returns Array of MatchedSell for the specified year
 */
export function getMatchesForYear(
    result: MatchingResult,
    taxYear: number
): MatchedSell[] {
    return result.matchesByYear.get(taxYear) || []
}

/**
 * Extracts unique BUY orders that were consumed by SELLs in a specific tax year.
 * This is useful for generating the XML report.
 *
 * @param matchedSells Array of MatchedSell for the tax year
 * @returns Array of unique {buy, totalQuantityUsed} consumed in the tax year
 */
export function getConsumedBuysForYear(
    matchedSells: MatchedSell[]
): { buy: Order; totalQuantityUsed: number }[] {
    // Aggregate quantities by BUY (using date + quantity as key)
    const buyMap = new Map<string, { buy: Order; totalQuantityUsed: number }>()

    for (const matchedSell of matchedSells) {
        for (const match of matchedSell.matches) {
            const key = `${match.buy.date.getTime()}-${match.buy.quantity}`

            if (buyMap.has(key)) {
                buyMap.get(key)!.totalQuantityUsed += match.quantityUsed
            } else {
                buyMap.set(key, {
                    buy: match.buy,
                    totalQuantityUsed: match.quantityUsed,
                })
            }
        }
    }

    // Sort by date ascending
    return Array.from(buyMap.values()).sort(
        (a, b) => a.buy.date.getTime() - b.buy.date.getTime()
    )
}

/**
 * Summary of matched transactions for a tax year.
 */
export interface TaxYearSummary {
    // Sells in the tax year
    sellCount: number
    totalSellQuantity: number
    totalSellValueEur: number
    // Matched buys (cost basis)
    buyCount: number
    totalBuyQuantity: number
    totalBuyValueEur: number
}

/**
 * Calculates summary statistics for matched transactions in a tax year.
 *
 * @param matchedSells Array of MatchedSell for the tax year
 * @returns Summary with sell totals and matched buy totals
 */
export function calculateTaxYearSummary(
    matchedSells: MatchedSell[]
): TaxYearSummary {
    let totalSellQuantity = 0
    let totalSellValueEur = 0

    for (const ms of matchedSells) {
        totalSellQuantity += ms.sell.quantity
        totalSellValueEur += ms.sell.quantity * ms.sell.pricePerUnitInEur
    }

    const consumedBuys = getConsumedBuysForYear(matchedSells)
    let totalBuyQuantity = 0
    let totalBuyValueEur = 0

    for (const { buy, totalQuantityUsed } of consumedBuys) {
        totalBuyQuantity += totalQuantityUsed
        totalBuyValueEur += totalQuantityUsed * buy.pricePerUnitInEur
    }

    return {
        sellCount: matchedSells.length,
        totalSellQuantity,
        totalSellValueEur,
        buyCount: consumedBuys.length,
        totalBuyQuantity,
        totalBuyValueEur,
    }
}
