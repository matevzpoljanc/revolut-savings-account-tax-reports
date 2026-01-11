"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/file-upload"
import { InstructionsAccordion } from "@/components/instructions-accordion"
import { AlertCircle, MapPin, FileCheck, ChevronRight } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface EligibilityCheckProps {
    taxYear: number
}

export function EligibilityCheck({ taxYear }: EligibilityCheckProps) {
    const [isResident, setIsResident] = useState(false)
    const [notSubmitted, setNotSubmitted] = useState(false)
    const [isChecked, setIsChecked] = useState(false)

    const isEligible = isResident && notSubmitted

    const handleCheck = () => {
        setIsChecked(true)
    }

    return (
        <div>
            {!isChecked ? (
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                            Preverite upravičenost
                        </h2>
                        <p className="text-slate-500">
                            Potrdite spodnji izjavi za nadaljevanje
                        </p>
                    </div>

                    <div className="space-y-3 mb-6">
                        {/* Resident checkbox card */}
                        <label
                            htmlFor="resident"
                            className={`
                                relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 block
                                ${
                                    isResident
                                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                }
                            `}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={`
                                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                                    ${isResident ? "bg-blue-100" : "bg-slate-100"}
                                `}
                                >
                                    <MapPin
                                        className={`h-5 w-5 ${isResident ? "text-blue-600" : "text-slate-400"}`}
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="text-base font-medium text-slate-700">
                                        Sem slovenski davčni rezident
                                    </span>
                                </div>
                                <Checkbox
                                    id="resident"
                                    checked={isResident}
                                    onCheckedChange={(checked) =>
                                        setIsResident(checked === true)
                                    }
                                    className="h-5 w-5"
                                />
                            </div>
                        </label>

                        {/* Not submitted checkbox card */}
                        <label
                            htmlFor="not-submitted"
                            className={`
                                relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 block
                                ${
                                    notSubmitted
                                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                }
                            `}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={`
                                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                                    ${notSubmitted ? "bg-blue-100" : "bg-slate-100"}
                                `}
                                >
                                    <FileCheck
                                        className={`h-5 w-5 ${notSubmitted ? "text-blue-600" : "text-slate-400"}`}
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="text-base font-medium text-slate-700">
                                        Obrazcev za {taxYear} še nisem oddal(a)
                                    </span>
                                </div>
                                <Checkbox
                                    id="not-submitted"
                                    checked={notSubmitted}
                                    onCheckedChange={(checked) =>
                                        setNotSubmitted(checked === true)
                                    }
                                    className="h-5 w-5"
                                />
                            </div>
                        </label>
                    </div>

                    <Button
                        className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
                        onClick={handleCheck}
                        disabled={!isEligible}
                    >
                        Nadaljuj
                        <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>

                    {!isEligible && (
                        <p className="text-sm text-center text-slate-400 mt-4">
                            Za nadaljevanje potrdite obe izjavi
                        </p>
                    )}
                </div>
            ) : isEligible ? (
                <div className="max-w-6xl mx-auto">
                    {/* Two-column layout on large screens */}
                    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                        {/* Left column - File upload */}
                        <div className="lg:col-span-8">
                            <FileUpload taxYear={taxYear} />
                        </div>

                        {/* Right column - Instructions */}
                        <aside className="lg:col-span-4 mt-8 lg:mt-0">
                            <div className="lg:sticky lg:top-8">
                                <div className="bg-card rounded-xl shadow-sm border border-border/50 p-6">
                                    <h2 className="text-lg font-semibold mb-4 text-foreground">
                                        Navodila za uporabo
                                    </h2>
                                    <InstructionsAccordion taxYear={taxYear} />
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            ) : (
                <Card className="p-6">
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Niste upravičeni</AlertTitle>
                        <AlertDescription>
                            Žal trenutno ne podpiramo vašega primera uporabe.
                        </AlertDescription>
                    </Alert>

                    <div className="text-center">
                        <p className="mb-4">
                            Oprostite, vendar trenutno ne podpiramo vašega
                            primera uporabe. To orodje je namenjeno samo
                            slovenskim rezidentom, ki še niso oddali davčnih
                            obrazcev za leto {taxYear}.
                        </p>

                        <Button
                            variant="outline"
                            onClick={() => setIsChecked(false)}
                        >
                            Nazaj na preverjanje
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    )
}
