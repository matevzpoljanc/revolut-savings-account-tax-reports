import { FundTransactions } from "./revolut-parser"

/**
 * Formats a number for XML output with 2 decimal places
 */
export function formatNumberForXML(value: number): string {
    // Format with 2 decimal places and use period as decimal separator
    return value.toFixed(2)
}

/**
 * Creates a single KDVPItem XML element for the given FundTransactions.
 * Each KDVPItem contains a <Securities> element with one <Row> per order.
 *
 * For BUY orders, a <Purchase> element is generated with:
 *   - F1: acquisition date (YYYY-MM-DD)
 *   - F2: "B"
 *   - F3: quantity (from quantity * pricePerUnitInEur)
 *   - F4: unit price "1"
 *
 * For SELL orders, a <Sale> element is generated with:
 *   - F6: sale date (YYYY-MM-DD)
 *   - F7: quantity (from quantity * pricePerUnitInEur)
 *   - F9: unit price "1"
 *   - F10: false
 *
 * @param fund The fund transactions to be converted.
 * @returns The XML string for a single KDVPItem.
 */
function createKDVPItem(fund: FundTransactions): string {
    let rowId = 1
    const rowLines: string[] = []

    fund.orders.forEach((order) => {
        // Format the date as YYYY-MM-DD
        const dateStr = order.date.toISOString().split("T")[0]
        // Calculate the EUR value using quantity and pricePerUnitInEur
        const formattedPricePerUnit = formatNumberForXML(
            Math.abs(order.pricePerUnitInEur)
        )
        // Format the quantity with 2 decimal places
        const formattedQuantity = formatNumberForXML(Math.abs(order.quantity))

        if (order.type === "BUY") {
            rowLines.push(
                `          <Row>
            <ID>${rowId++}</ID>
            <Purchase>
              <F1>${dateStr}</F1>
              <F2>B</F2>
              <F3>${formattedQuantity}</F3>
              <F4>${formattedPricePerUnit}</F4>
            </Purchase>
          </Row>`
            )
        } else if (order.type === "SELL") {
            rowLines.push(
                `          <Row>
            <ID>${rowId++}</ID>
            <Sale>
              <F6>${dateStr}</F6>
              <F7>${formattedQuantity}</F7>
              <F9>${formattedPricePerUnit}</F9>
              <F10>false</F10>
            </Sale>
          </Row>`
            )
        }
    })

    const rowsXml = rowLines.join("\n")

    // Build the Securities element wrapping the rows.
    const securitiesXml = `        <Securities>
          ${fund.isin ? `<ISIN>${fund.isin}</ISIN>` : ""}
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
 * Generates a full Doh_KDVP XML document wrapped in an Envelope.
 *
 * The envelope structure is:
 *
 * <?xml version="1.0" encoding="utf-8"?>
 * <Envelope xmlns="http://edavki.durs.si/Documents/Schemas/Doh_KDVP_9.xsd"
 *   xmlns:edp="http://edavki.durs.si/Documents/Schemas/EDP-Common-1.xsd">
 *   <edp:Header>
 *     <edp:taxpayer>
 *       <edp:taxNumber>[taxNumber]</edp:taxNumber>
 *       <edp:taxpayerType>FO</edp:taxpayerType>
 *     </edp:taxpayer>
 *   </edp:Header>
 *   <edp:AttachmentList />
 *   <edp:Signatures>
 *   </edp:Signatures>
 *   <body>
 *     <edp:bodyContent />
 *     <Doh_KDVP>
 *       ... KDVP content ...
 *     </Doh_KDVP>
 *   </body>
 * </Envelope>
 *
 * Within the Doh_KDVP element, a KDVP header is generated using the provided reporting
 * year, and one KDVPItem element is created per FundTransactions entry.
 *
 * @param transactionsArray Array of fund transactions to be reported.
 * @param year Reporting year.
 * @param taxNumber Taxpayer's tax number.
 * @returns The full XML document as a string.
 */
export function generateFullDohKDVPXML(
    transactionsArray: FundTransactions[],
    year: number,
    taxNumber: string
): string {
    // Filter out funds with no orders
    const fundsWithOrders = transactionsArray.filter(
        (fund) => fund.orders.length > 0
    )

    // Create a KDVPItem for each FundTransactions.
    const kdvpItemsXml = fundsWithOrders.map(createKDVPItem).join("\n")

    // Build the KDVP header using the provided reporting year.
    const kdvpHeaderXml = `      <KDVP>
        <DocumentWorkflowID>O</DocumentWorkflowID>
        <Year>${year}</Year>
        <PeriodStart>${year}-01-01</PeriodStart>
        <PeriodEnd>${year}-12-31</PeriodEnd>
        <IsResident>true</IsResident>
        <SecurityCount>${fundsWithOrders.length}</SecurityCount>
        <SecurityShortCount>0</SecurityShortCount>
        <SecurityWithContractCount>0</SecurityWithContractCount>
        <SecurityWithContractShortCount>0</SecurityWithContractShortCount>
        <ShareCount>0</ShareCount>
      </KDVP>`

    // Combine the header and KDVPItem elements into the Doh_KDVP element.
    const dohKdvpXml = `    <Doh_KDVP>
${kdvpHeaderXml}
${kdvpItemsXml}
    </Doh_KDVP>`

    // Build the full Envelope document.
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
    // Calculate total interest in EUR
    let totalInterestInEur = 0
    funds.forEach((fund) => {
        fund.interest_payments.forEach((payment) => {
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
 * @returns Object indicating which forms are available
 */
export function getAvailableTaxForms(transactions: FundTransactions[]): {
    kdvp: boolean
    interest: boolean
} {
    const hasOrders = transactions.some((fund) => fund.orders.length > 0)
    const hasInterest = transactions.some(
        (fund) => fund.interest_payments.length > 0
    )

    return {
        kdvp: hasOrders,
        interest: hasInterest,
    }
}
