"use client"

import { useState } from "react"
import { FileUpload } from "@/components/file-upload"
import { ThemeProvider } from "@/components/theme-provider"
import { EligibilityCheck } from "@/components/eligibility-check"
import { InstructionsAccordion } from "@/components/instructions-accordion"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function Home() {
    const [taxYear, setTaxYear] = useState<number>(2025)

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
            <main className="min-h-screen bg-background">
                <div className="container mx-auto px-4 py-12">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-3xl font-bold text-center mb-2">
                            FURS & Revolut Saving Accounts
                        </h1>
                        <h2 className="text-xl text-center text-muted-foreground mb-6 flex items-center justify-center gap-2">
                            Priprava davčnih obrazcev za leto
                            <Select
                                value={taxYear.toString()}
                                onValueChange={(value) =>
                                    setTaxYear(parseInt(value))
                                }
                            >
                                <SelectTrigger className="w-24 h-8 text-xl border border-muted-foreground/30 rounded-md px-2 bg-background hover:bg-muted/50 focus:ring-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024">2024</SelectItem>
                                    <SelectItem value="2025">2025</SelectItem>
                                </SelectContent>
                            </Select>
                        </h2>

                        <EligibilityCheck taxYear={taxYear} />

                        <div className="bg-card rounded-lg shadow-md p-6 mt-8">
                            <h2 className="text-xl font-semibold mb-4">
                                Navodila za uporabo
                            </h2>
                            <InstructionsAccordion taxYear={taxYear} />
                        </div>
                    </div>
                </div>
            </main>
        </ThemeProvider>
    )
}
