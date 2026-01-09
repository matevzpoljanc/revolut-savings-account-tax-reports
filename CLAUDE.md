# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js web application that helps Slovenian residents generate XML tax forms for Revolut Savings Accounts. The application processes Revolut CSV statements client-side and generates XML files for submission to eDavki (Slovenian tax authority).

**Key constraint**: All data processing happens client-side in the browser for privacy. No backend server or external API calls (except for static conversion-rates.json).

## Development Commands

```bash
# Install dependencies
yarn install

# Start development server (localhost:3000)
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Run linter
yarn lint
```

## Core Architecture

### Data Flow Pipeline

The application follows a linear processing pipeline:

1. **User Input** → CSV file + 8-digit tax number
2. **CSV Parsing** (`lib/revolut-parser.ts`) → Extracts transactions by currency/ISIN
3. **Currency Conversion** → Uses `public/conversion-rates.json` to convert to EUR
4. **XML Generation** (`lib/tax-generator.ts`) → Creates eDavki-compliant XML files
5. **Output** → Downloadable XML files + human-readable report

### Directory Structure

- **`/app`** - Next.js App Router pages (layout, main page, globals.css)
- **`/components`** - React components (UI layer)
    - `file-upload.tsx` - Core component handling upload, processing, and results (465 lines)
    - `eligibility-check.tsx` - Pre-qualification form
    - `instructions-accordion.tsx` - User guide
    - `/ui` - shadcn/ui component library (52 reusable components)
- **`/lib`** - Business logic (parsing, generation, utilities)
    - `revolut-parser.ts` - CSV parsing and currency conversion
    - `tax-generator.ts` - XML generation for eDavki forms
    - `report-generator.ts` - Human-readable summary reports
- **`/hooks`** - Custom React hooks (toast notifications)
- **`/public`** - Static assets including `conversion-rates.json`

### Key Technical Details

**CSV Parsing Strategy** (`lib/revolut-parser.ts`):

- Detects fund sections by currency using header regex: `- ([A-Z]{3})`
- Switches to "transaction mode" when line starts with "Transactions for"
- Extracts ISIN codes via regex: `\b[A-Z]{2}[0-9A-Z]{9}[0-9]\b`
- Processes three transaction types: BUY, SELL, and Interest PAID
- Converts all amounts to EUR using historical rates from conversion-rates.json

**XML Generation** (`lib/tax-generator.ts`):

- **Doh_KDVP**: Capital gains form for BUY/SELL orders
    - Schema: `http://edavki.durs.si/Documents/Schemas/Doh_KDVP_9.xsd`
    - BUY: F1 (date), F2 ("B"), F3 (quantity), F4 (price)
    - SELL: F6 (date), F7 (quantity), F9 (price), F10 (false)
- **Doh_Obr**: Interest income form
    - Schema: `http://edavki.durs.si/Documents/Schemas/Doh_Obr_2.xsd`
    - Reports total interest to Revolut Securities Europe UAB (Lithuania)
    - Applies 25% tax rate

**Data Structures**:

```typescript
FundTransactions {
  currency: string
  isin?: string
  orders: Order[]           // BUY/SELL transactions
  interest_payments: InterestPayment[]
}
```

### Important Patterns

**State Management**:

- React useState hooks only (no external state library)
- State flows: file → parsedData → result → XML downloads
- Components pass data via props

**Client Components**:

- Always add `"use client"` directive for components using useState/useEffect
- Avoid hydration mismatches (don't use className/style on server-rendered elements differently than client)

**Localization**:

- UI text in Slovenian
- Number formatting: `sl-SI` locale (comma as decimal separator)
- Date display: DD.MM.YYYY format
- Date in XML: YYYY-MM-DD format

**Validation**:

- Tax number: Must be exactly 8 digits (regex: `/^\d{8}$/`)
- CSV format: Expects Revolut "Consolidated Statement" structure

**Styling**:

- Uses Tailwind CSS with shadcn/ui components
- Do not install additional UI libraries unless necessary
- Use lucide-react for icons
- Aim for production-quality, beautiful designs

## Common Modifications

**Updating Tax Year**:

- Tax year is now selectable in the UI (defaults to 2025)
- To add more years, update the Select component in `file-upload.tsx` (lines ~241-244)
- Year is passed dynamically to all XML generation functions

**Adding New Currencies**:

- Add conversion rates to `public/conversion-rates.json`
- Parser will automatically handle new currencies in CSV

**Modifying XML Schema**:

- eDavki schemas are versioned (currently KDVP_9, Obr_2)
- Update schema URLs and XML structure in `tax-generator.ts`
- Ensure compliance with eDavki validation rules

**Adding New Transaction Types**:

- Extend `parseTransactions()` in `revolut-parser.ts`
- Add new data structure to `FundTransactions` interface
- Update XML generation logic accordingly

## Testing Approach

When testing changes:

1. Use a real Revolut CSV export (or create test CSV matching format)
2. Verify parsing outputs correct `FundTransactions[]` structure
3. Check XML validates against eDavki schemas
4. Test with edge cases: missing ISIN, multiple currencies, zero transactions
5. Validate EUR conversion accuracy using conversion-rates.json

## Privacy Considerations

All data processing is client-side:

- No server-side code or API endpoints
- Only static file served: `conversion-rates.json`
- CSV files never leave the user's browser
- Can be deployed as static site (Netlify, Vercel, etc.)
