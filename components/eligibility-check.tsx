"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/file-upload"
import { AlertCircle, Info } from "lucide-react"
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
                <Card className="p-6">
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold mb-2">
                                Je ta stran zame?
                            </h2>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-center">
                            <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center space-x-2 mb-1">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    <p className="text-blue-800 font-medium">
                                        Zasebnost:
                                    </p>
                                </div>
                                <p className="text-blue-700">
                                    Vsi podatki se obdelujejo izključno lokalno
                                    v vašem brskalniku. <br />
                                    Podatki se ne pošiljajo na strežnik ali
                                    kakorkoli shranjujejo.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="resident"
                                    checked={isResident}
                                    onCheckedChange={(checked) =>
                                        setIsResident(checked === true)
                                    }
                                    className="mt-1"
                                />
                                <div className="space-y-1">
                                    <Label
                                        htmlFor="resident"
                                        className="text-base font-medium cursor-pointer"
                                    >
                                        Sem slovenski rezident
                                    </Label>
                                </div>
                            </div>

                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="not-submitted"
                                    checked={notSubmitted}
                                    onCheckedChange={(checked) =>
                                        setNotSubmitted(checked === true)
                                    }
                                    className="mt-1"
                                />
                                <div className="space-y-1">
                                    <Label
                                        htmlFor="not-submitted"
                                        className="text-base font-medium cursor-pointer"
                                    >
                                        Obrazcev za leto {taxYear} še nisem
                                        oddal(a)
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full"
                            onClick={handleCheck}
                            disabled={!isEligible}
                        >
                            Nadaljuj
                        </Button>

                        {!isEligible && (
                            <p className="text-sm text-center text-muted-foreground">
                                Za nadaljevanje morate potrditi obe izjavi
                            </p>
                        )}
                    </div>
                </Card>
            ) : isEligible ? (
                <FileUpload taxYear={taxYear} />
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
