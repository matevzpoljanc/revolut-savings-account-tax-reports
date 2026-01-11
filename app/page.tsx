"use client"

import { useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { EligibilityCheck } from "@/components/eligibility-check"
import { Shield } from "lucide-react"
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
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-white to-slate-50">
                {/* Hero Header */}
                <header className="pt-12 pb-8 lg:pt-16 lg:pb-12">
                    <div className="container mx-auto px-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            Brezplačno orodje za davčno napoved
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                            Revolut Savings Account
                        </h1>
                        <p className="text-xl lg:text-2xl text-slate-600 mb-2">
                            Priprava davčnih obrazcev za FURS
                        </p>
                        <div className="flex items-center justify-center gap-2 text-lg text-slate-500">
                            <span>Davčno leto</span>
                            <Select
                                value={taxYear.toString()}
                                onValueChange={(value) =>
                                    setTaxYear(parseInt(value))
                                }
                            >
                                <SelectTrigger className="w-24 h-9 text-lg font-semibold border-2 border-blue-200 rounded-lg px-3 bg-white hover:border-blue-300 focus:ring-2 focus:ring-blue-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024">2024</SelectItem>
                                    <SelectItem value="2025">2025</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 container mx-auto px-4 pb-12">
                    <EligibilityCheck taxYear={taxYear} />
                </main>

                {/* Footer with Privacy Notice */}
                <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm">
                    <div className="container mx-auto px-4 py-6">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-slate-600">
                                    Zasebnost:
                                </span>
                            </div>
                            <span>
                                Vsi podatki se obdelujejo izključno lokalno v
                                vašem brskalniku. Nič se ne pošilja na strežnik.
                            </span>
                        </div>
                    </div>
                </footer>
            </div>
        </ThemeProvider>
    )
}
