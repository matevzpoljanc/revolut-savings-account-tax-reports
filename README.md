# FURS & Revolut Saving Accounts Tax Helper

A web application to help Slovenian residents generate tax forms for Revolut Saving Accounts.

## Demo deployment

[https://meek-sable-39d7ad.netlify.app/](https://meek-sable-39d7ad.netlify.app/)

## Features

- Upload and process Revolut account statements in CSV format
- Automatic transaction parsing for savings accounts
- Generate tax forms in XML format for direct submission to eDavki
- Track purchases, sales, and interest payments
- Calculate tax obligations for interest income (25% tax rate)
- Generate comprehensive financial reports
- Process data entirely client-side for privacy

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Yarn or npm

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd <project-directory>

# Install dependencies
yarn install
# or
npm install
```

### Development

```bash
# Start development server
yarn dev
# or
npm run dev
```

The application will be available at http://localhost:3000

### Build for Production

```bash
# Build the application
yarn build
# or
npm run build

# Start the production server
yarn start
# or
npm start
```

## How to Use

1. **Export Data from Revolut**
    - Go to your Revolut profile > Documents & statements > Consolidated statement
    - Select "Excel" format, "Tax Year" for period, and year 2024
    - If you use other Revolut services, filter to "Savings & funds" only
    - Click "Generate" to download the CSV file

2. **Generate XML Files**
    - Upload the CSV file to the web application
    - Enter your 8-digit Slovenian tax number
    - Process the file to generate the XML tax forms
    - Download the generated XML files

3. **Submit to eDavki**
    - Go to the eDavki portal
    - Upload the XML files
    - Verify the imported data for accuracy before submission
    - Submit the forms

## Technologies

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Privacy

All data processing happens locally in your browser. No data is sent to any server or stored.

## Disclaimer

This tool is provided as-is to assist with tax filing. The author assumes no responsibility for the accuracy of the data or forms generated. Always verify the data before submitting to tax authorities.

## License

[MIT License](LICENSE)
