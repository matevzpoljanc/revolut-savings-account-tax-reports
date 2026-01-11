"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
    Upload,
    FileText,
    Download,
    AlertCircle,
    FileCode,
    Info,
    CheckCircle2,
    HelpCircle,
    ExternalLink,
    AlertTriangle,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Papa from "papaparse"
import {
    parseTransactions,
    validateRevolutCSV,
    isValidCSVFile,
    mergeTransactions,
    type FundTransactions,
} from "@/lib/revolut-parser"
import {
    validateHistory,
    matchTransactionsFIFO,
    getMatchesForYear,
    type HistoryValidation,
    type MatchedSell,
} from "@/lib/cost-basis"
import { generateReport, formatNumber } from "@/lib/report-generator"
import {
    getAvailableTaxForms,
    generateTaxOfficeXml,
    generateDohKDVPFromMatches,
} from "@/lib/tax-generator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface FileUploadProps {
    taxYear: number
}

export function FileUpload({ taxYear }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [parsedData, setParsedData] = useState<FundTransactions[] | null>(
        null
    )
    const [taxNumber, setTaxNumber] = useState<string>("")
    const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        details?: string
        downloadUrl?: string
        fileName?: string
        availableForms?: { kdvp: boolean; interest: boolean }
    } | null>(null)

    // Multi-file upload state
    const [uploadedFiles, setUploadedFiles] = useState<
        { name: string; size: number }[]
    >([])
    const [allTransactions, setAllTransactions] = useState<FundTransactions[]>(
        []
    )
    const [historyValidation, setHistoryValidation] =
        useState<HistoryValidation | null>(null)
    const [matchedSellsByFund, setMatchedSellsByFund] = useState<
        Map<string, MatchedSell[]>
    >(new Map())

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            // Validate file extension
            if (!isValidCSVFile(selectedFile.name)) {
                setResult({
                    success: false,
                    message: "Nepodprta vrsta datoteke",
                    details:
                        "Prosimo, naložite datoteko v CSV formatu. V Revolut aplikaciji izberite 'Excel' format pri izvozu.",
                })
                return
            }

            // Read and validate CSV content immediately
            Papa.parse(selectedFile, {
                header: false,
                complete: async (results) => {
                    const data = results.data as string[][]
                    const validation = validateRevolutCSV(data)

                    if (!validation.isValid) {
                        setResult({
                            success: false,
                            message:
                                validation.error ||
                                "Napaka pri preverjanju datoteke",
                            details: validation.details,
                        })
                        return
                    }

                    // Parse the transactions
                    try {
                        const newTransactions = await parseTransactions(data)

                        // Merge with existing transactions
                        const merged = mergeTransactions(
                            allTransactions,
                            newTransactions
                        )

                        // Validate history completeness
                        const historyCheck = validateHistory(merged)

                        // Run FIFO matching for all transactions
                        const matchesByFund = new Map<string, MatchedSell[]>()
                        for (const fund of merged) {
                            const matchResult = matchTransactionsFIFO(
                                fund.orders
                            )
                            const yearMatches = getMatchesForYear(
                                matchResult,
                                taxYear
                            )
                            if (yearMatches.length > 0) {
                                matchesByFund.set(fund.currency, yearMatches)
                            }
                        }

                        // Update state
                        setAllTransactions(merged)
                        setHistoryValidation(historyCheck)
                        setMatchedSellsByFund(matchesByFund)
                        setUploadedFiles((prev) => [
                            ...prev,
                            {
                                name: selectedFile.name,
                                size: selectedFile.size,
                            },
                        ])
                        setFile(selectedFile)
                        setResult(null)
                        setParsedData(merged)
                    } catch (error) {
                        console.error("Error parsing transactions:", error)
                        setResult({
                            success: false,
                            message: "Napaka pri obdelavi transakcij",
                            details:
                                "Datoteke ni bilo mogoče obdelati. Preverite format datoteke.",
                        })
                    }
                },
                error: () => {
                    setResult({
                        success: false,
                        message: "Napaka pri branju datoteke",
                        details:
                            "Datoteke ni bilo mogoče prebrati. Preverite, da datoteka ni poškodovana in je v pravilnem CSV formatu.",
                    })
                },
            })
        }
    }

    const handleProcessFile = () => {
        setShowDisclaimerModal(true)
    }

    const processFile = async () => {
        // Use allTransactions if available (multi-file), otherwise require file
        if (allTransactions.length === 0 && !file) return

        setIsProcessing(true)
        setProgress(0)
        setResult(null)
        setShowDisclaimerModal(false)

        try {
            // Use already-merged transactions from allTransactions
            const transactions = allTransactions

            // Log the parsed transactions to the console
            console.log("Processing transactions:", transactions)

            // Update progress
            setProgress(50)

            // Generate a report from the transactions
            await new Promise((resolve) => setTimeout(resolve, 300))
            setProgress(80)

            // Check which tax forms can be generated for the tax year
            const availableForms = getAvailableTaxForms(transactions, taxYear)

            // Generate the report using the separate function
            const reportText = generateReport(transactions)

            // Create a blob for download
            const blob = new Blob([reportText], {
                type: "text/plain",
            })
            const url = URL.createObjectURL(blob)

            // Update progress to 100%
            setProgress(100)

            // Check if any forms are available
            const hasAvailableForms =
                availableForms.kdvp || availableForms.interest

            if (hasAvailableForms) {
                setResult({
                    success: true,
                    message: "Davčni obrazci so bili uspešno pripravljeni!",
                    downloadUrl: url,
                    fileName: "davcni_obrazci_revolut.txt",
                    availableForms,
                })
            } else {
                setResult({
                    success: false,
                    message:
                        "Ni bilo mogoče generirati XML datotek. V datoteki ni bilo najdenih ustreznih transakcij za leto " +
                        taxYear +
                        ".",
                    downloadUrl: url,
                    fileName: "davcni_obrazci_revolut.txt",
                })
            }
        } catch (error) {
            console.error("Error processing transactions:", error)
            setResult({
                success: false,
                message:
                    "Prišlo je do napake pri obdelavi transakcij. Format datoteke morda ni pravilen.",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const downloadTaxXML = (xmlKey: "kdvp" | "interest", fileName: string) => {
        if (!parsedData || !taxNumber || !result?.availableForms?.[xmlKey])
            return

        let xmlContent = ""

        // Generate the appropriate XML based on the key
        if (xmlKey === "kdvp") {
            // FIFO matching is required by law - only generate if we have matched sells
            if (matchedSellsByFund.size > 0) {
                // Build fund info map
                const fundInfo = new Map<string, { isin?: string }>()
                for (const fund of parsedData) {
                    fundInfo.set(fund.currency, { isin: fund.isin })
                }
                xmlContent = generateDohKDVPFromMatches(
                    matchedSellsByFund,
                    fundInfo,
                    taxYear,
                    taxNumber
                )
            }
            // No fallback - if no matched sells, there's nothing to report
        } else if (xmlKey === "interest") {
            const fundsWithInterest = parsedData.filter(
                (fund) => fund.interest_payments.length > 0
            )
            if (fundsWithInterest.length > 0) {
                xmlContent = generateTaxOfficeXml(
                    fundsWithInterest,
                    taxYear,
                    taxNumber
                )
            }
        }

        if (!xmlContent) return

        const blob = new Blob([xmlContent], { type: "application/xml" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const resetForm = () => {
        setFile(null)
        setResult(null)
        setParsedData(null)
        setProgress(0)
        setUploadedFiles([])
        setAllTransactions([])
        setHistoryValidation(null)
        setMatchedSellsByFund(new Map())
    }

    const isValidTaxNumber = (num: string) => {
        // Slovenian tax number is 8 digits
        return /^\d{8}$/.test(num)
    }

    const hasXMLFiles =
        result?.success &&
        result?.availableForms &&
        (result.availableForms.kdvp || result.availableForms.interest)

    return (
        <>
            <Card className="p-6">
                <div className="space-y-6">
                    {/* Only show title and subtitle if we don't have successful XML generation */}
                    {!hasXMLFiles && (
                        <div className="text-center">
                            <h2 className="text-xl font-semibold mb-2">
                                Naložite Excel (v CSV formatu) datoteko
                            </h2>
                            <p className="text-muted-foreground">
                                Izberite izvoženo Excel datoteko iz vašega
                                Revolut računa
                            </p>
                        </div>
                    )}

                    {!file && !result && (
                        <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                            <p className="mb-4 text-muted-foreground">
                                Povlecite in spustite Excel (v CSV formatu)
                                datoteko ali kliknite za izbiro
                            </p>
                            <input
                                type="file"
                                id="file-upload"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Button
                                onClick={() =>
                                    document
                                        .getElementById("file-upload")
                                        ?.click()
                                }
                            >
                                Izberite datoteko
                            </Button>
                        </div>
                    )}

                    {file && !isProcessing && !result && (
                        <div className="space-y-4">
                            {/* List of uploaded files */}
                            {uploadedFiles.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Naložene datoteke:
                                    </p>
                                    {uploadedFiles.map((f, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center p-3 bg-muted rounded-md"
                                        >
                                            <FileText className="h-5 w-5 mr-2 text-primary" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {f.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(f.size / 1024).toFixed(2)}{" "}
                                                    KB
                                                </p>
                                            </div>
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* History validation warning */}
                            {historyValidation &&
                                !historyValidation.isComplete && (
                                    <Alert className="bg-amber-50 border-amber-200">
                                        <AlertCircle className="h-4 w-4 text-amber-600" />
                                        <AlertTitle className="text-amber-800">
                                            Manjkajo nakupi
                                        </AlertTitle>
                                        <AlertDescription className="text-amber-700">
                                            <p className="mb-2">
                                                {historyValidation.deficit
                                                    ?.message ||
                                                    "Za pravilno generiranje KDVP obrazca potrebujete starejše izpiske."}
                                            </p>
                                            <p className="text-sm">
                                                Naložite dodatne izpiske iz
                                                prejšnjih let, da zagotovite
                                                popolno zgodovino transakcij.
                                            </p>
                                        </AlertDescription>
                                    </Alert>
                                )}

                            {/* History complete notification */}
                            {historyValidation &&
                                historyValidation.isComplete && (
                                    <Alert className="bg-green-50 border-green-200">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <AlertTitle className="text-green-800">
                                            Zgodovina transakcij je popolna
                                        </AlertTitle>
                                        <AlertDescription className="text-green-700">
                                            Vsi nakupi so najdeni za vse
                                            prodaje. Lahko nadaljujete z
                                            generiranjem obrazcev.
                                        </AlertDescription>
                                    </Alert>
                                )}

                            {/* Add more files button */}
                            <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                                <input
                                    type="file"
                                    id="file-upload-additional"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        document
                                            .getElementById(
                                                "file-upload-additional"
                                            )
                                            ?.click()
                                    }
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Dodaj izpisek za leto{" "}
                                    {historyValidation?.deficit?.sellDate
                                        ? historyValidation.deficit.sellDate.getFullYear() -
                                          1
                                        : taxYear - 1}
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tax-number">
                                        Davčna številka
                                    </Label>
                                    <Input
                                        id="tax-number"
                                        placeholder="Vnesite 8-mestno davčno številko"
                                        value={taxNumber}
                                        onChange={(e) =>
                                            setTaxNumber(e.target.value)
                                        }
                                        className={
                                            !taxNumber ||
                                            isValidTaxNumber(taxNumber)
                                                ? ""
                                                : "border-red-500"
                                        }
                                    />
                                    {taxNumber &&
                                        !isValidTaxNumber(taxNumber) && (
                                            <p className="text-xs text-red-500">
                                                Davčna številka mora vsebovati 8
                                                številk
                                            </p>
                                        )}
                                </div>

                                <Alert className="bg-blue-50 border-blue-200">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    <AlertTitle className="text-blue-800">
                                        Davčna številka
                                    </AlertTitle>
                                    <AlertDescription className="text-blue-700">
                                        Davčna številka je potrebna za
                                        generiranje XML datoteke za davčno
                                        upravo. Podatki se obdelujejo izključno
                                        lokalno v vašem brskalniku.
                                    </AlertDescription>
                                </Alert>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleProcessFile}
                                disabled={
                                    !!taxNumber && !isValidTaxNumber(taxNumber)
                                }
                            >
                                Obdelaj datoteko
                            </Button>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">
                                Obdelava datoteke...
                            </p>
                            <Progress value={progress} className="h-2" />
                            <p className="text-center text-sm text-muted-foreground">
                                {progress}% končano
                            </p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6">
                            {result.success ? (
                                <>
                                    <Alert className="bg-green-50 border-green-200">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        <AlertTitle className="text-green-800 text-lg">
                                            Uspešno!
                                        </AlertTitle>
                                        <AlertDescription className="text-green-700">
                                            {result.message}
                                        </AlertDescription>
                                    </Alert>

                                    {/* XML files section - made more prominent */}
                                    {result.availableForms &&
                                        (result.availableForms.kdvp ||
                                            result.availableForms.interest) && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                                                <h3 className="text-lg font-semibold mb-3 text-blue-800">
                                                    Datoteke za oddajo na
                                                    eDavki:
                                                </h3>

                                                <div className="grid gap-3">
                                                    {result.availableForms
                                                        .kdvp && (
                                                        <Button
                                                            size="lg"
                                                            className="w-full flex justify-between items-center bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 hover:border-blue-400 shadow-sm"
                                                            onClick={() =>
                                                                downloadTaxXML(
                                                                    "kdvp",
                                                                    `Doh_KDVP_Revolut_${taxYear}.xml`
                                                                )
                                                            }
                                                            disabled={
                                                                !isValidTaxNumber(
                                                                    taxNumber
                                                                ) ||
                                                                !historyValidation?.isComplete
                                                            }
                                                        >
                                                            <span className="flex items-center">
                                                                <FileCode className="mr-3 h-5 w-5 text-blue-600" />
                                                                <span className="text-base font-medium">
                                                                    Doh_KDVP_Revolut_
                                                                    {taxYear}
                                                                    .xml
                                                                </span>
                                                            </span>
                                                            <Download className="h-5 w-5 text-blue-600" />
                                                        </Button>
                                                    )}

                                                    {result.availableForms
                                                        .interest && (
                                                        <Button
                                                            size="lg"
                                                            className="w-full flex justify-between items-center bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 hover:border-blue-400 shadow-sm"
                                                            onClick={() =>
                                                                downloadTaxXML(
                                                                    "interest",
                                                                    `Doh_Obr_Revolut_${taxYear}.xml`
                                                                )
                                                            }
                                                            disabled={
                                                                !isValidTaxNumber(
                                                                    taxNumber
                                                                )
                                                            }
                                                        >
                                                            <span className="flex items-center">
                                                                <FileCode className="mr-3 h-5 w-5 text-blue-600" />
                                                                <span className="text-base font-medium">
                                                                    Doh_Obr_Revolut_
                                                                    {taxYear}
                                                                    .xml
                                                                </span>
                                                            </span>
                                                            <Download className="h-5 w-5 text-blue-600" />
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Link to eDavki import page */}
                                                <div className="mt-4 pt-4 border-t border-blue-200">
                                                    <a
                                                        href="https://edavki.durs.si/EdavkiPortal/PersonalPortal/CommonPages/Documents/Import.aspx"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Odpri eDavki portal za
                                                        uvoz
                                                    </a>
                                                </div>

                                                <div className="mt-3 flex items-start space-x-2 text-sm">
                                                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                                    <p className="text-blue-700">
                                                        Po uvozu XML datotek na
                                                        eDavki nujno preverite
                                                        pravilnost podatkov pred
                                                        oddajo.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                    {/* Warning about scope */}
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex gap-3">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-sm text-amber-800">
                                                <p className="font-medium mb-1">
                                                    Pomembno
                                                </p>
                                                <p>
                                                    Obrazca Doh-KDVP in Doh-Obr
                                                    vsebujeta{" "}
                                                    <strong>
                                                        samo podatke iz Revolut
                                                        Savings računa
                                                    </strong>
                                                    . Če imate še druge naložbe,
                                                    ki ste jih dolžni poročati v
                                                    izbranem davčnem letu
                                                    (delnice, kripto, druge
                                                    obresti), jih morate v
                                                    obrazce dodati ročno.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary section - transactions and interest */}
                                    {parsedData && parsedData.length > 0 && (
                                        <div className="bg-muted p-4 rounded-md">
                                            <h3 className="font-medium mb-3">
                                                Povzetek za davčno leto{" "}
                                                {taxYear}:
                                            </h3>

                                            {(() => {
                                                // Calculate totals across all funds
                                                let totalInterestEur = 0
                                                let interestCount = 0

                                                for (const fund of parsedData) {
                                                    const taxYearInterest =
                                                        fund.interest_payments.filter(
                                                            (p) =>
                                                                p.date.getFullYear() ===
                                                                taxYear
                                                        )
                                                    totalInterestEur +=
                                                        taxYearInterest.reduce(
                                                            (sum, p) =>
                                                                sum +
                                                                (p.quantityInEur ||
                                                                    0),
                                                            0
                                                        )
                                                    interestCount +=
                                                        taxYearInterest.length
                                                }

                                                // Calculate sells and buys from matched transactions
                                                let sellCount = 0
                                                let sellValueEur = 0
                                                let buyCount = 0
                                                let buyValueEur = 0

                                                Array.from(
                                                    matchedSellsByFund.values()
                                                ).forEach((matches) => {
                                                    matches.forEach(
                                                        (matchedSell) => {
                                                            sellCount++
                                                            sellValueEur +=
                                                                matchedSell.sell
                                                                    .quantity *
                                                                matchedSell.sell
                                                                    .pricePerUnitInEur
                                                            matchedSell.matches.forEach(
                                                                (match) => {
                                                                    buyCount++
                                                                    buyValueEur +=
                                                                        match.quantityUsed *
                                                                        match
                                                                            .buy
                                                                            .pricePerUnitInEur
                                                                }
                                                            )
                                                        }
                                                    )
                                                })

                                                const taxObligation =
                                                    totalInterestEur * 0.25

                                                const hasTransactions =
                                                    sellCount > 0 ||
                                                    interestCount > 0

                                                if (!hasTransactions) {
                                                    return (
                                                        <p className="text-muted-foreground">
                                                            Ni transakcij za
                                                            leto {taxYear}.
                                                        </p>
                                                    )
                                                }

                                                return (
                                                    <div className="space-y-3">
                                                        {/* Sells and Buys section */}
                                                        {sellCount > 0 && (
                                                            <>
                                                                <div className="flex justify-between items-center py-2 border-b">
                                                                    <span>
                                                                        Prodaje
                                                                        (
                                                                        {
                                                                            sellCount
                                                                        }{" "}
                                                                        {sellCount ===
                                                                        1
                                                                            ? "transakcija"
                                                                            : sellCount ===
                                                                                2
                                                                              ? "transakciji"
                                                                              : sellCount <=
                                                                                  4
                                                                                ? "transakcije"
                                                                                : "transakcij"}
                                                                        )
                                                                    </span>
                                                                    <span className="font-bold">
                                                                        {formatNumber(
                                                                            sellValueEur
                                                                        )}{" "}
                                                                        EUR
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center py-2 border-b">
                                                                    <span>
                                                                        Nabavna
                                                                        vrednost
                                                                        (
                                                                        {
                                                                            buyCount
                                                                        }{" "}
                                                                        {buyCount ===
                                                                        1
                                                                            ? "nakup"
                                                                            : buyCount ===
                                                                                2
                                                                              ? "nakupa"
                                                                              : buyCount <=
                                                                                  4
                                                                                ? "nakupi"
                                                                                : "nakupov"}
                                                                        )
                                                                    </span>
                                                                    <span className="font-bold">
                                                                        {formatNumber(
                                                                            buyValueEur
                                                                        )}{" "}
                                                                        EUR
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}

                                                        {/* Interest section */}
                                                        {interestCount > 0 && (
                                                            <>
                                                                <div className="flex justify-between items-center py-2 border-b">
                                                                    <span>
                                                                        Skupne
                                                                        obresti
                                                                        (
                                                                        {
                                                                            interestCount
                                                                        }{" "}
                                                                        {interestCount ===
                                                                        1
                                                                            ? "izplačilo"
                                                                            : interestCount ===
                                                                                2
                                                                              ? "izplačili"
                                                                              : interestCount <=
                                                                                  4
                                                                                ? "izplačila"
                                                                                : "izplačil"}
                                                                        )
                                                                    </span>
                                                                    <span className="font-bold">
                                                                        {formatNumber(
                                                                            totalInterestEur
                                                                        )}{" "}
                                                                        EUR
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center py-2 bg-amber-50 px-3 rounded-md">
                                                                    <span className="font-medium">
                                                                        Predvidena
                                                                        davčna
                                                                        obveznost
                                                                        (25%)
                                                                    </span>
                                                                    <span className="font-bold text-amber-800">
                                                                        {formatNumber(
                                                                            taxObligation
                                                                        )}{" "}
                                                                        EUR
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={resetForm}
                                    >
                                        Začni znova
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Napaka</AlertTitle>
                                        <AlertDescription>
                                            {result.message}
                                        </AlertDescription>
                                    </Alert>

                                    {/* Show validation details if present */}
                                    {result.details && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                                            <div className="flex space-x-3">
                                                <HelpCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                <div className="space-y-2">
                                                    <p className="text-amber-700">
                                                        {result.details}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Special error message for when no XML files were generated */}
                                    {!result.details &&
                                        result.message.includes(
                                            "Ni bilo mogoče generirati XML datotek"
                                        ) && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                                                <div className="flex space-x-3">
                                                    <HelpCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <div className="space-y-2">
                                                        <h3 className="font-medium text-amber-800">
                                                            Ali ste uporabili
                                                            &quot;Consolidated
                                                            statement&quot;?
                                                        </h3>
                                                        <p className="text-amber-700">
                                                            Preverite, ali ste
                                                            izvozili podatke z
                                                            uporabo
                                                            &quot;Consolidated
                                                            statement&quot; kot
                                                            je navedeno v
                                                            navodilih:
                                                        </p>
                                                        <ol className="list-decimal pl-5 space-y-1 text-amber-700">
                                                            <li>
                                                                V Revolut
                                                                aplikaciji
                                                                kliknite na
                                                                ikono profila
                                                            </li>
                                                            <li>
                                                                Izberite{" "}
                                                                <b>
                                                                    Documents &
                                                                    statements
                                                                    &gt;
                                                                    Consolidated
                                                                    statement
                                                                </b>
                                                            </li>
                                                            <li>
                                                                Izberite format
                                                                &quot;Excel&quot;,
                                                                obdobje
                                                                &quot;Tax
                                                                Year&quot; in
                                                                željeno leto
                                                                (npr. {taxYear})
                                                            </li>
                                                            <li>
                                                                Če uporabljate
                                                                več Revolut
                                                                storitev,
                                                                nastavite filter
                                                                na &quot;Savings
                                                                & funds&quot;
                                                            </li>
                                                        </ol>
                                                        <p className="text-amber-700 font-medium">
                                                            Če ste uporabili
                                                            drug način izvoza,
                                                            podatki morda niso v
                                                            pravilnem formatu.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={resetForm}
                                    >
                                        Poskusi znova
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            <Dialog
                open={showDisclaimerModal}
                onOpenChange={setShowDisclaimerModal}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Uporaba na lastno odgovornost</DialogTitle>
                        <DialogDescription className="pt-4">
                            Orodje je zgolj v pomoč pri oddaji davčne napovedi -
                            avtor ne prevzema nobene odgovornosti za pravilnost
                            podatkov ali obrazcev.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDisclaimerModal(false)}
                        >
                            Prekliči
                        </Button>
                        <Button onClick={processFile}>
                            Razumem in želim nadaljevati
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
