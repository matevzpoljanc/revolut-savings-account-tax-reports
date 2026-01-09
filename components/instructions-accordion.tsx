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
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem
                value="item-1"
                className="border-b border-muted-foreground/20"
            >
                <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex items-center text-left">
                        <span className="font-medium text-lg">
                            1. Izvoz podatkov iz Revoluta
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                    <div className="pl-8 space-y-2 text-card-foreground">
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
                                Klknite na{" "}
                                <b>
                                    Documents & statements &gt; Consolidated
                                    statement
                                </b>{" "}
                            </li>
                            <li>
                                Izberite moznosto &quot;Excel&quot;,
                                &quot;Period&quot; = &quot;Tax Year&quot; in
                                leto {taxYear}
                            </li>
                            <li>
                                <b>POMEMBNO:</b> Če ste poleg savings accounta
                                uporabljali še druge Revolut storitve
                                (Commodities, Crypto ali Brokerage Account), na
                                vrhu popravit filter iz &quot;All products&quot;
                                na &quot;Savings & funds&quot;
                            </li>
                            <li>
                                Kliknite na <b>Generate</b>
                            </li>
                        </ol>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value="item-2"
                className="border-b border-muted-foreground/20"
            >
                <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex items-center text-left">
                        <span className="font-medium text-lg">
                            2. Priprava XML datotek
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                    <div className="pl-8 space-y-2 text-card-foreground">
                        <p>
                            Uporabite to spletno stran za generiranje XML
                            datotek:
                        </p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Naložite CSV datoteko v obrazec zgoraj</li>
                            <li>Vnesite vašo 8-mestno davčno številko</li>
                            <li>Kliknite na &quot;Obdelaj datoteko&quot;</li>
                            <li>Počakajte, da se podatki obdelajo</li>
                            <li>Prenesite generirane XML datoteke</li>
                        </ol>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
                <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex items-center text-left">
                        <span className="font-medium text-lg">
                            3. Oddaja na eDavki
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                    <div className="pl-8 space-y-2 text-card-foreground">
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
