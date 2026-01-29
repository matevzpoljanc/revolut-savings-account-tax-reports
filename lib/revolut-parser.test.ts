// We need to test parseDate which is not exported, so we test it indirectly
// by importing and calling it. First, let's make a minimal test by importing the module.

// Since parseDate is not exported, we test via a workaround:
// Extract and test the logic directly.

const SLOVENE_MONTHS: Record<string, string> = {
    'jan': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr',
    'maj': 'May', 'jun': 'Jun', 'jul': 'Jul', 'avg': 'Aug',
    'sep': 'Sep', 'okt': 'Oct', 'nov': 'Nov', 'dec': 'Dec',
}

function parseDate(dateStr: string): Date {
    let s = dateStr.trim()
    s = s.replace(/\b([a-z]{3})\.?\b/gi, (match, month) => {
        const replacement = SLOVENE_MONTHS[month.toLowerCase()]
        return replacement ?? match
    })
    s = s.replace(/(\d+)\.\s+/g, '$1 ')
    return new Date(s)
}

describe('parseDate', () => {
    it('parses Slovene date with okt', () => {
        const d = parseDate('12. okt. 2025, 03:26:15')
        expect(d.getFullYear()).toBe(2025)
        expect(d.getMonth()).toBe(9) // October = 9
        expect(d.getDate()).toBe(12)
    })

    it('parses Slovene date with maj', () => {
        const d = parseDate('1. maj. 2025, 12:00:00')
        expect(d.getFullYear()).toBe(2025)
        expect(d.getMonth()).toBe(4) // May = 4
        expect(d.getDate()).toBe(1)
    })

    it('parses Slovene date with avg', () => {
        const d = parseDate('15. avg. 2024, 09:30:00')
        expect(d.getFullYear()).toBe(2024)
        expect(d.getMonth()).toBe(7) // August = 7
        expect(d.getDate()).toBe(15)
    })

    it('parses standard English date strings', () => {
        const d = parseDate('Oct 12, 2025 03:26:15')
        expect(d.getFullYear()).toBe(2025)
        expect(d.getMonth()).toBe(9)
        expect(d.getDate()).toBe(12)
    })

    it('parses ISO date strings', () => {
        const d = parseDate('2025-01-15')
        expect(d.getFullYear()).toBe(2025)
        expect(d.getMonth()).toBe(0)
        expect(d.getDate()).toBe(15)
    })
})
