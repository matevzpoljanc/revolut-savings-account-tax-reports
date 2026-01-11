"use client"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { ChevronDown } from "lucide-react"

interface InstructionsAccordionProps {
    taxYear: number
}

export function InstructionsAccordion({ taxYear }: InstructionsAccordionProps) {
    return (
        <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem
                value="item-1"
                className="border border-border/50 rounded-lg px-3 data-[state=open]:bg-muted/30"
            >
                <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center text-left gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                            1
                        </span>
                        <span className="font-medium text-base">
                            Izvoz podatkov iz Revoluta
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                    <div className="pl-9 space-y-2 text-muted-foreground text-sm">
                        <p>
                            Pridobite CSV (Excel) datoteko iz vašega Revolut
                            računa:
                        </p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>
                                V levem zgornjem kotu kliknite na ikono vašega
                                profila, da se odpre &quot;Account&quot; meni
                            </li>
                            <li>
                                Kliknite na{" "}
                                <b>
                                    Documents & statements &gt; Consolidated
                                    statement
                                </b>{" "}
                            </li>
                            <li>
                                Izberite možnost &quot;Excel&quot;,
                                &quot;Period&quot; = &quot;Tax Year&quot; in
                                leto {taxYear}
                            </li>
                            <li>
                                <b>POMEMBNO:</b> Če ste poleg savings accounta
                                uporabljali še druge Revolut storitve
                                (Commodities, Crypto ali Brokerage Account), na
                                vrhu popravite filter iz &quot;All
                                products&quot; na &quot;Savings & funds&quot;
                            </li>
                            <li>
                                Kliknite na <b>Generate</b>
                            </li>
                        </ol>
                        <p className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
                            <b>Opomba:</b> Če ste z varčevanjem začeli pred
                            letom {taxYear}, boste morda morali naložiti tudi
                            izpiske iz prejšnjih let, da zagotovite popolno
                            zgodovino transakcij.
                        </p>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value="item-2"
                className="border border-border/50 rounded-lg px-3 data-[state=open]:bg-muted/30"
            >
                <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center text-left gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                            2
                        </span>
                        <span className="font-medium text-base">
                            Priprava XML datotek
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                    <div className="pl-9 space-y-2 text-muted-foreground text-sm">
                        <p>
                            Uporabite to spletno stran za generiranje XML
                            datotek:
                        </p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Naložite CSV datoteko za leto {taxYear}</li>
                            <li>
                                Če program zahteva dodatne izpiske iz prejšnjih
                                let, jih naložite z gumbom &quot;Dodaj
                                izpisek&quot;
                            </li>
                            <li>Vnesite vašo 8-mestno davčno številko</li>
                            <li>Kliknite na &quot;Obdelaj datoteko&quot;</li>
                            <li>Prenesite generirane XML datoteke</li>
                        </ol>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value="item-3"
                className="border border-border/50 rounded-lg px-3 data-[state=open]:bg-muted/30"
            >
                <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center text-left gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                            3
                        </span>
                        <span className="font-medium text-base">
                            Oddaja na eDavki
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                    <div className="pl-9 space-y-2 text-muted-foreground text-sm">
                        <p>Oddajte XML datoteke na portalu eDavki:</p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>
                                Odprite stran za uvoz dokumentov na{" "}
                                <a
                                    href="https://edavki.durs.si/EdavkiPortal/PersonalPortal/CommonPages/Documents/Import.aspx"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    portalu eDavki
                                </a>
                            </li>
                            <li>
                                Naložite prenesene XML datoteke (izberi &
                                prenesi datoteko)
                            </li>
                            <li className="font-bold text-blue-800 bg-blue-50 p-2 rounded-md border border-blue-200">
                                <span className="flex items-start">
                                    <span>
                                        PREVERITE PRAVILNOST UVOŽENIH PODATKOV!
                                    </span>
                                </span>
                            </li>
                            <li>Po potrebi uredite podatke</li>
                            <li>Oddajte obrazce</li>
                        </ol>
                        <p className="text-sm text-muted-foreground mt-2">
                            <strong>Pomembno:</strong> Vedno preverite
                            pravilnost podatkov pred oddajo. Za obrazec Doh-KDVP
                            preverite, da so pravilno vneseni datumi in zneski
                            nakupov ter prodaj. Za obrazec Doh-Obr preverite, da
                            so pravilno vneseni zneski prejetih obresti.
                        </p>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
