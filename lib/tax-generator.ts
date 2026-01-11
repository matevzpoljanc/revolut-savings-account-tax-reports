import { FundTransactions, Order } from "./revolut-parser"
import { MatchedSell, getConsumedBuysForYear } from "./cost-basis"

/**
 * Formats a number for XML output with 2 decimal places
 */
export function formatNumberForXML(value: number): string {
    // Format with 2 decimal places and use period as decimal separator
    return value.toFixed(2)
}

/**
 * Represents a row for XML generation - either a BUY or SELL with tracking info
 */
interface XmlRow {
    type: "BUY" | "SELL"
    date: Date
    quantity: number // in EUR
    pricePerUnit: number
}

/**
 * Creates a single KDVPItem XML element from matched transactions.
 * This version uses FIFO-matched data to ensure proper cost basis tracking.
 *
 * For BUY orders (from matched purchases):
 *   - F1: acquisition date (YYYY-MM-DD)
 *   - F2: "B"
 *   - F3: quantity (EUR value)
 *   - F4: unit price "1.00"
 *
 * For SELL orders:
 *   - F6: sale date (YYYY-MM-DD)
 *   - F7: quantity (EUR value)
 *   - F9: unit price "1.00"
 *   - F10: false
 *
 * @param matchedSells Matched sells for this fund in the tax year
 * @param isin Optional ISIN for the fund
 * @returns The XML string for a single KDVPItem.
 */
function createKDVPItemFromMatches(
    matchedSells: MatchedSell[],
    isin?: string
): string {
    if (matchedSells.length === 0) {
        return ""
    }

    // Get all consumed BUYs for this tax year
    const consumedBuys = getConsumedBuysForYear(matchedSells)

    // Build chronological list of rows for XML
    const rows: XmlRow[] = []

    // Add BUY rows (the purchases that cover the sells)
    for (const { buy, totalQuantityUsed } of consumedBuys) {
        rows.push({
            type: "BUY",
            date: buy.date,
            quantity: totalQuantityUsed,
            pricePerUnit: buy.pricePerUnitInEur,
        })
    }

    // Add SELL rows
    for (const matchedSell of matchedSells) {
        rows.push({
            type: "SELL",
            date: matchedSell.sell.date,
            quantity: matchedSell.sell.quantity,
            pricePerUnit: matchedSell.sell.pricePerUnitInEur,
        })
    }

    // Sort all rows by date
    rows.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Generate XML rows
    let rowId = 1
    const rowLines: string[] = []

    for (const row of rows) {
        const dateStr = row.date.toISOString().split("T")[0]
        const formattedQuantity = formatNumberForXML(row.quantity)

        const formattedPrice = formatNumberForXML(row.pricePerUnit)

        if (row.type === "BUY") {
            rowLines.push(
                `          <Row>
            <ID>${rowId++}</ID>
            <Purchase>
              <F1>${dateStr}</F1>
              <F2>B</F2>
              <F3>${formattedQuantity}</F3>
              <F4>${formattedPrice}</F4>
            </Purchase>
          </Row>`
            )
        } else {
            rowLines.push(
                `          <Row>
            <ID>${rowId++}</ID>
            <Sale>
              <F6>${dateStr}</F6>
              <F7>${formattedQuantity}</F7>
              <F9>${formattedPrice}</F9>
              <F10>false</F10>
            </Sale>
          </Row>`
            )
        }
    }

    const rowsXml = rowLines.join("\n")

    // Build the Securities element wrapping the rows.
    const securitiesXml = `        <Securities>
          ${isin ? `<ISIN>${isin}</ISIN>` : ""}
          <IsFond>false</IsFond>
${rowsXml}
        </Securities>`

    // Return the complete KDVPItem element.
    return `      <KDVPItem>
        <InventoryListType>PLVP</InventoryListType>
${securitiesXml}
      </KDVPItem>`
}

/**
 * Generates a full Doh_KDVP XML document from FIFO-matched transactions.
 *
 * @param matchesByFund Map of fund currency to matched sells for that fund
 * @param fundInfo Map of fund currency to fund info (ISIN, etc)
 * @param year Reporting year
 * @param taxNumber Taxpayer's tax number
 * @returns The full XML document as a string
 */
export function generateDohKDVPFromMatches(
    matchesByFund: Map<string, MatchedSell[]>,
    fundInfo: Map<string, { isin?: string }>,
    year: number,
    taxNumber: string
): string {
    const kdvpItems: string[] = []

    Array.from(matchesByFund.entries()).forEach(([currency, matchedSells]) => {
        if (matchedSells.length === 0) return
        const info = fundInfo.get(currency)
        const itemXml = createKDVPItemFromMatches(matchedSells, info?.isin)
        if (itemXml) {
            kdvpItems.push(itemXml)
        }
    })

    if (kdvpItems.length === 0) {
        return ""
    }

    const kdvpItemsXml = kdvpItems.join("\n")

    // Build the KDVP header
    const kdvpHeaderXml = `      <KDVP>
        <DocumentWorkflowID>O</DocumentWorkflowID>
        <Year>${year}</Year>
        <PeriodStart>${year}-01-01</PeriodStart>
        <PeriodEnd>${year}-12-31</PeriodEnd>
        <IsResident>true</IsResident>
        <SecurityCount>${kdvpItems.length}</SecurityCount>
        <SecurityShortCount>0</SecurityShortCount>
        <SecurityWithContractCount>0</SecurityWithContractCount>
        <SecurityWithContractShortCount>0</SecurityWithContractShortCount>
        <ShareCount>0</ShareCount>
      </KDVP>`

    const dohKdvpXml = `    <Doh_KDVP>
${kdvpHeaderXml}
${kdvpItemsXml}
    </Doh_KDVP>`

    const envelopeXml = `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://edavki.durs.si/Documents/Schemas/Doh_KDVP_9.xsd"
  xmlns:edp="http://edavki.durs.si/Documents/Schemas/EDP-Common-1.xsd">
  <edp:Header>
    <edp:taxpayer>
      <edp:taxNumber>${taxNumber}</edp:taxNumber>
      <edp:taxpayerType>FO</edp:taxpayerType>
    </edp:taxpayer>
  </edp:Header>
  <edp:AttachmentList />
  <edp:Signatures>
  </edp:Signatures>
  <body>
    <edp:bodyContent />
${dohKdvpXml}
  </body>
</Envelope>`

    return envelopeXml
}

/**
 * Generates an XML document for tax reporting of interest income.
 *
 * @param funds - Array of FundTransactions.
 * @param taxYear - Tax year (e.g. 2024).
 * @param taxNumber - Tax number of the taxpayer.
 * @returns A string containing the XML document.
 */
export function generateTaxOfficeXml(
    funds: FundTransactions[],
    taxYear: number,
    taxNumber: string
): string {
    // Calculate total interest in EUR for the tax year only
    let totalInterestInEur = 0
    funds.forEach((fund) => {
        fund.interest_payments.forEach((payment) => {
            // Only include interest payments from the selected tax year
            if (payment.date.getFullYear() !== taxYear) {
                return
            }
            // Use the provided EUR amount if available; otherwise, if the currency is EUR use the original amount.
            if (payment.quantityInEur !== undefined) {
                totalInterestInEur += payment.quantityInEur
            } else if (payment.currency === "EUR") {
                totalInterestInEur += payment.amount
            }
            // If conversion for non-EUR amounts is needed, add your conversion logic here.
        })
    })

    // Format the total to two decimal places
    const formattedTotal = formatNumberForXML(totalInterestInEur)

    // Build the XML string using a template literal.
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://edavki.durs.si/Documents/Schemas/Doh_Obr_2.xsd"
    xmlns:edp="http://edavki.durs.si/Documents/Schemas/EDP-Common-1.xsd">
    <edp:Header>
        <edp:taxpayer>
            <edp:taxNumber>${taxNumber}</edp:taxNumber>
            <edp:taxpayerType>FO</edp:taxpayerType>
        </edp:taxpayer>
    </edp:Header>
    <edp:AttachmentList />
    <edp:Signatures>
    </edp:Signatures>
    <body>
        <edp:bodyContent />
        <Doh_Obr>
            <Period>${taxYear}</Period>
            <DocumentWorkflowID>O</DocumentWorkflowID>
            <ResidentOfRepublicOfSlovenia>true</ResidentOfRepublicOfSlovenia>
            <Country>SI</Country>
            <Interest>
                <Date>${taxYear}-12-31</Date>
                <IdentificationNumber>305799582</IdentificationNumber>
                <Name>Revolut Securities Europe UAB</Name>
                <Address>Konstitucijos ave. 21B, Vilnius, Lithuania, LT-08130</Address>
                <Country>LT</Country>
                <Type>7</Type>
                <Value>${formattedTotal}</Value>
                <Country2>LT</Country2>
            </Interest>
            <Reduction>
                <Country1>SI</Country1>
                <Country2>SI</Country2>
                <Country3>SI</Country3>
                <Country4>SI</Country4>
                <Country5>SI</Country5>
            </Reduction>
        </Doh_Obr>
    </body>
</Envelope>`

    return xml
}

/**
 * Checks which tax forms can be generated based on the transactions
 * @param transactions Array of fund transactions
 * @param taxYear Optional tax year to filter by
 * @returns Object indicating which forms are available
 */
export function getAvailableTaxForms(
    transactions: FundTransactions[],
    taxYear?: number
): {
    kdvp: boolean
    interest: boolean
} {
    // KDVP is only needed when there are SELL orders in the tax year (disposals to report)
    const hasSells = transactions.some((fund) =>
        fund.orders.some(
            (o) =>
                o.type === "SELL" &&
                (!taxYear || o.date.getFullYear() === taxYear)
        )
    )

    // Check for interest in the specific tax year if provided
    const hasInterest = transactions.some((fund) =>
        fund.interest_payments.some(
            (p) => !taxYear || p.date.getFullYear() === taxYear
        )
    )

    return {
        kdvp: hasSells,
        interest: hasInterest,
    }
}
