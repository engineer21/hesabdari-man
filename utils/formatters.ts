export const persianToArabic = (str: string): string => {
    if (!str) return '';
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
    return str.replace(/[۰-۹]/g, w => persianDigits.indexOf(w).toString()).replace(/[٠-٩]/g, w => arabicIndicDigits.indexOf(w).toString());
}

export const toPersianDigits = (str: string | number): string => {
    if (str === null || str === undefined) return '';
    const persian: { [key: string]: string } = {
        '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', 
        '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
    };
    return String(str).replace(/[0-9]/g, (w) => persian[w]);
};

export const formatNumberWithCommas = (value: number | string): string => {
    const numStr = String(value).replace(/,|٬/g, '');
    const num = parseInt(persianToArabic(numStr), 10);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { useGrouping: true });
};


export const getLocalDateISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Parse user-entered amount (Persian/Arabic digits, commas) to integer tomans. */
export const parseIntegerAmount = (raw: string, allowZero = false): number => {
    const normalized = persianToArabic(String(raw ?? '')).replace(/[,٬\s]/g, '');
    if (normalized === '') return 0;
    const n = parseInt(normalized, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    if (n === 0 && !allowZero) return 0;
    return n;
};