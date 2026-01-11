# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js web application that helps Slovenian residents generate XML tax forms for Revolut Savings Accounts. The application processes Revolut CSV statements client-side and generates XML files for submission to eDavki (Slovenian tax authority).

**Key constraint**: All data processing happens client-side in the browser for privacy. No backend server or external API calls (except for static conversion-rates.json).

**Recent major architectural change (Jan 2026)**: Implemented FIFO (First-In-First-Out) matching logic to properly match BUY and SELL orders for accurate cost basis reporting. This replaces the previous simple order listing approach and ensures tax compliance.

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

# Run tests (Jest)
yarn test

# Run tests in watch mode
yarn test:watch

# Update currency conversion rates (requires Python)
python scripts/update-conversion-rates.py
```

## Core Architecture

### Data Flow Pipeline

The application follows a linear processing pipeline:

1. **User Input** → CSV file + 8-digit tax number + tax year
2. **CSV Validation** (`lib/revolut-parser.ts`) → Validates file format before processing
3. **CSV Parsing** (`lib/revolut-parser.ts`) → Extracts transactions by currency/ISIN
4. **Currency Conversion** → Uses `public/conversion-rates.json` to convert to EUR
5. **FIFO Matching** (`lib/cost-basis.ts`) → Matches BUY/SELL orders chronologically for tax reporting
6. **History Validation** → Ensures all SELLs can be matched with BUYs (complete transaction history)
7. **XML Generation** (`lib/tax-generator.ts`) → Creates eDavki-compliant XML files using matched transactions
8. **Output** → Downloadable XML files + human-readable report

### Directory Structure

- **`/app`** - Next.js App Router pages (layout, main page, globals.css)
- **`/components`** - React components (UI layer)
    - `file-upload.tsx` - Core component handling upload, processing, and results (465 lines)
    - `eligibility-check.tsx` - Pre-qualification form
    - `instructions-accordion.tsx` - User guide
    - `/ui` - shadcn/ui component library (52 reusable components)
- **`/lib`** - Business logic (parsing, generation, utilities)
    - `revolut-parser.ts` - CSV parsing, validation, and currency conversion
    - `cost-basis.ts` - FIFO matching logic for BUY/SELL orders (276 lines)
    - `tax-generator.ts` - XML generation for eDavki forms using FIFO-matched data
    - `report-generator.ts` - Human-readable summary reports
    - `*.test.ts` - Jest test files (cost-basis, tax-generator)
- **`/hooks`** - Custom React hooks (toast notifications)
- **`/public`** - Static assets including `conversion-rates.json`
- **`/scripts`** - Utility scripts
    - `update-conversion-rates.py` - Python script to update currency conversion rates

### Key Technical Details

**CSV Validation** (`lib/revolut-parser.ts`):

- `validateRevolutCSV()` validates file before processing
- Checks for minimum content length (at least 3 rows)
- Looks for Revolut-specific headers: "Summary", "Transactions for", "Flexible Cash Funds"
- Returns `ValidationResult` with error messages in Slovenian

**CSV Parsing Strategy** (`lib/revolut-parser.ts`):

- Detects fund sections by currency using header regex: `- ([A-Z]{3})`
- Switches to "transaction mode" when line starts with "Transactions for"
- Extracts ISIN codes via regex: `\b[A-Z]{2}[0-9A-Z]{9}[0-9]\b`
- Processes three transaction types: BUY, SELL, and Interest PAID
- Converts all amounts to EUR using historical rates from conversion-rates.json

**FIFO Matching Logic** (`lib/cost-basis.ts`):

- **Core Algorithm**: `matchTransactionsFIFO()` implements First-In-First-Out matching
    - Sorts all transactions chronologically
    - Maintains a queue of `BuyLot[]` (oldest first)
    - BUY orders add new lots to the queue
    - SELL orders consume from the front of the queue (oldest first)
    - Returns `MatchingResult` with matches grouped by tax year and remaining inventory

- **History Validation**: `validateHistory()` ensures complete transaction history
    - Tracks running inventory for each fund
    - Detects if any SELL happens before sufficient BUY orders
    - Returns detailed deficit information in Slovenian

- **Helper Functions**:
    - `getMatchesForYear()` - extracts matches for a specific tax year
    - `getConsumedBuysForYear()` - gets unique BUY orders consumed by SELLs in a tax year
    - `calculateTaxYearSummary()` - calculates totals for reporting

- **Key Data Structures**:
    - `BuyLot` - tracks remaining quantity from each BUY order
    - `MatchedSell` - links each SELL to the BUY orders that cover it
    - `MatchingResult` - contains all matches grouped by year plus remaining inventory

**XML Generation** (`lib/tax-generator.ts`):

- **Uses FIFO-matched data** from `cost-basis.ts` instead of raw order lists
- **Doh_KDVP**: Capital gains form for BUY/SELL orders
    - Schema: `http://edavki.durs.si/Documents/Schemas/Doh_KDVP_9.xsd`
    - Uses `createKDVPItemFromMatches()` which takes `MatchedSell[]` as input
    - BUY rows: F1 (date), F2 ("B"), F3 (quantity used in EUR), F4 (price per unit)
    - SELL rows: F6 (date), F7 (quantity in EUR), F9 (price per unit), F10 (false)
    - All rows sorted chronologically in the XML
- **Doh_Obr**: Interest income form
    - Schema: `http://edavki.durs.si/Documents/Schemas/Doh_Obr_2.xsd`
    - Reports total interest to Revolut Securities Europe UAB (Lithuania)
    - Applies 25% tax rate

**Data Structures**:

```typescript
// From revolut-parser.ts
FundTransactions {
  currency: string
  isin?: string
  orders: Order[]           // BUY/SELL transactions
  interest_payments: InterestPayment[]
}

// From cost-basis.ts
BuyLot {
  buy: Order
  remainingQuantity: number  // decreases as consumed by SELLs
}

MatchedSell {
  sell: Order
  matches: {
    buy: Order
    quantityUsed: number     // portion of this BUY consumed
  }[]
}

MatchingResult {
  matchesByYear: Map<number, MatchedSell[]>
  remainingLots: BuyLot[]
  finalInventory: number     // EUR value of remaining inventory
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
- CSV format:
    - `validateRevolutCSV()` checks for Revolut "Consolidated Statement" structure
    - Validates minimum content and required headers
    - Provides detailed error messages in Slovenian
- Transaction history:
    - `validateHistory()` ensures all SELLs can be matched with BUYs
    - Detects incomplete transaction history (missing earlier BUY orders)
    - Returns deficit details with currency, ISIN, date, and quantity

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
- Use `scripts/update-conversion-rates.py` to automate fetching historical rates
- Parser will automatically handle new currencies in CSV

**Modifying XML Schema**:

- eDavki schemas are versioned (currently KDVP_9, Obr_2)
- Update schema URLs and XML structure in `tax-generator.ts`
- Ensure compliance with eDavki validation rules

**Adding New Transaction Types**:

- Extend `parseTransactions()` in `revolut-parser.ts`
- Add new data structure to `FundTransactions` interface
- Update FIFO matching in `cost-basis.ts` if needed
- Update XML generation logic accordingly

**Modifying FIFO Matching**:

- All matching logic is in `lib/cost-basis.ts`
- Core algorithm is in `matchTransactionsFIFO()`
- To change matching method (e.g., LIFO, specific lot), modify this function
- Update tests in `lib/cost-basis.test.ts` when changing logic
- XML generation depends on `MatchedSell[]` structure - keep interface consistent

## Testing Approach

**Unit Tests** (Jest):

- Tests located in `lib/*.test.ts` files
- Run with `yarn test` or `yarn test:watch`
- Current coverage:
    - `cost-basis.test.ts` - FIFO matching logic, validation, helper functions
    - `tax-generator.test.ts` - XML generation functions
- Use `describe()` and `it()` blocks for test organization

**Manual Testing**:

When testing changes manually:

1. Use a real Revolut CSV export (or create test CSV matching format)
2. Verify CSV validation catches invalid files
3. Verify parsing outputs correct `FundTransactions[]` structure
4. Check FIFO matching correctly pairs BUY/SELL orders
5. Validate history completeness (no deficit errors for complete history)
6. Check XML validates against eDavki schemas
7. Test with edge cases: missing ISIN, multiple currencies, zero transactions, partial BUY consumption
8. Validate EUR conversion accuracy using conversion-rates.json

## Currency Conversion Rates

**Updating Rates** (`scripts/update-conversion-rates.py`):

- Python script to fetch historical EUR conversion rates
- Updates `public/conversion-rates.json` with latest rates
- Fetches rates from external API (e.g., ECB or similar)
- Run before the new tax year to ensure rates are current
- The script should be run locally - not part of the build process

**Rate Structure** (`public/conversion-rates.json`):

- Maps date strings (YYYY-MM-DD) to currency rate objects
- Example: `"2024-01-15": { "USD": 1.09, "GBP": 0.86, ... }`
- Rates are EUR per 1 unit of foreign currency
- Used by parser to convert all transactions to EUR

## Privacy Considerations

All data processing is client-side:

- No server-side code or API endpoints
- Only static file served: `conversion-rates.json`
- CSV files never leave the user's browser
- Can be deployed as static site (Netlify, Vercel, etc.)
