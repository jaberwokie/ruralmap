

## Problem

The CSV upload silently fails because every row in the CSV is wrapped in quotes. For example, the header row is:
```
"Name,Type,City,County,Latitude,Longitude,Notes"
```

The current parser does `lines[0].split(',')` which, because the entire line is one quoted string, produces headers like `["\"Name"`, `"Type"`, ...`"Notes\""`]. The quote characters and BOM (`\uFEFF`) cause header matching (`headers.indexOf('name')`) to fail, so the function returns early at line 100 with no feedback.

Additionally, there's **no user feedback** — no toast, no error message — so the user has no idea what happened.

## Plan

### 1. Add robust CSV line parsing to Sidebar.tsx

- Strip BOM from the file content
- Strip surrounding quotes from each line (the CSV wraps entire rows in quotes)
- Use a proper quote-aware CSV field parser for splitting fields
- Normalize headers (trim, lowercase, remove diacritics)

### 2. Add success/error toasts

- Show a toast on successful import with count of facilities added
- Show an error toast if headers can't be matched or no valid rows found

### 3. Changes

**`src/components/map/Sidebar.tsx`:**
- Import `toast` from sonner
- Replace the `handleCSVUpload` function:
  - Strip BOM from text
  - For each line, strip wrapping quotes if the entire line is quoted
  - Use a quote-aware field parser (handle `""` escapes, commas inside quotes)
  - Normalize headers for flexible matching
  - Add toast notifications for success/failure

This is a focused fix to the existing CSV parsing logic — no structural changes needed.

