import { FundTransactions } from "./revolut-parser"

/**
 * Formats a number using Slovenian locale (comma as decimal separator, dot as thousands separator)
 */
export function formatNumber(value: number): string {
    return value.toLocaleString("sl-SI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

/**
 * Generates a report from the parsed transaction data
 * @param transactions Array of fund transactions
 * @returns Formatted report text
 */
export function generateReport(transactions: FundTransactions[]): string {
    let reportText = "# Poročilo o transakcijah Revolut Flexible Accounts\n\n"

    transactions.forEach((fund) => {
        reportText += `## Valuta: ${fund.currency}`
        if (fund.isin) {
            reportText += ` (ISIN: ${fund.isin})`
        }
        reportText += "\n\n"

        if (fund.orders.length > 0) {
            reportText += "### Nakupi in prodaje\n\n"
            reportText +=
                "Datum | Tip | Količina | Cena na enoto | Znesek (EUR)\n"
            reportText +=
                "------|-----|----------|---------------|------------\n"

            fund.orders.forEach((order) => {
                // Format the date as DD.MM.YYYY
                const formattedDate = order.date.toLocaleDateString("sl-SI", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                })

                // Calculate the EUR value
                const valueInEur = order.quantity * order.pricePerUnitInEur

                // Format the amounts using Slovenian locale
                const formattedQuantity = formatNumber(order.quantity)
                const formattedPricePerUnit = order.pricePerUnit
                const formattedEurAmount = formatNumber(valueInEur)

                reportText += `${formattedDate} | ${order.type} | ${formattedQuantity} ${fund.currency} | ${formattedPricePerUnit} | ${formattedEurAmount} EUR\n`
            })

            reportText += "\n"
        }

        if (fund.interest_payments.length > 0) {
            reportText += "### Izplačila obresti\n\n"
            reportText += "Datum | Znesek | Znesek (EUR)\n"
            reportText += "------|--------|------------\n"

            fund.interest_payments.forEach((payment) => {
                // Format the date as DD.MM.YYYY
                const formattedDate = payment.date.toLocaleDateString("sl-SI", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                })

                // Format the amounts using Slovenian locale
                const formattedAmount = formatNumber(payment.amount)
                const formattedEurAmount = payment.quantityInEur
                    ? formatNumber(payment.quantityInEur)
                    : "N/A"

                reportText += `${formattedDate} | ${formattedAmount} ${fund.currency} | ${formattedEurAmount} EUR\n`
            })

            reportText += "\n"

            // Calculate and add tax obligation
            const summary = calculateFundSummary(fund)
            const taxObligation = summary.totalInterestAmount * 0.25 // 25% tax
            const taxObligationEur = summary.totalInterestAmountEur * 0.25 // 25% tax in EUR

            reportText += `### Davčna obveznost\n\n`
            reportText += `Skupni znesek obresti: **${formatNumber(summary.totalInterestAmount)} ${fund.currency}** (${formatNumber(summary.totalInterestAmountEur)} EUR)\n`
            reportText += `Davčna obveznost (25%): **${formatNumber(taxObligation)} ${fund.currency}** (${formatNumber(taxObligationEur)} EUR)\n\n`
        }

        reportText += "\n"
    })

    return reportText
}

/**
 * Calculates summary statistics for a fund
 * @param fund Fund transactions data
 * @returns Object containing summary statistics
 */
export function calculateFundSummary(fund: FundTransactions) {
    // Count buy and sell transactions
    const buyTransactions = fund.orders.filter((order) => order.type === "BUY")
    const sellTransactions = fund.orders.filter(
        (order) => order.type === "SELL"
    )

    // Calculate total amounts (using absolute values)
    const totalBuyAmount = buyTransactions.reduce(
        (sum, order) => sum + Math.abs(order.quantity),
        0
    )
    const totalSellAmount = sellTransactions.reduce(
        (sum, order) => sum + Math.abs(order.quantity),
        0
    )
    const totalInterestAmount = fund.interest_payments.reduce(
        (sum, payment) => sum + Math.abs(payment.amount),
        0
    )

    // Calculate EUR equivalents
    const totalBuyAmountEur = buyTransactions.reduce(
        (sum, order) =>
            sum + Math.abs(order.quantity * order.pricePerUnitInEur),
        0
    )
    const totalSellAmountEur = sellTransactions.reduce(
        (sum, order) =>
            sum + Math.abs(order.quantity * order.pricePerUnitInEur),
        0
    )
    const totalInterestAmountEur = fund.interest_payments.reduce(
        (sum, payment) => sum + Math.abs(payment.quantityInEur || 0),
        0
    )

    return {
        buyTransactions,
        sellTransactions,
        totalBuyAmount,
        totalSellAmount,
        totalInterestAmount,
        totalBuyAmountEur,
        totalSellAmountEur,
        totalInterestAmountEur,
    }
}
