export interface GoogleSheetsApiResponse<T> {
  data: T[];
}

type MappedSheet<T, KeyField extends keyof T, ValueField extends keyof T> = Omit<T, KeyField | ValueField> & {
  default: T[ValueField];
};

export async function fetchSheetMap<
  T extends Record<string, any>,
  KeyField extends keyof T,
  ValueField extends keyof T
>(
  sheetName: string,
  keyField: KeyField,
  valueField: ValueField,
  revalidateSeconds: number = 60
): Promise<Record<string, MappedSheet<T, KeyField, ValueField>>> {
  try {
    const baseUrl = process.env.DEPLOYED_VERCEL_URL
    if (!baseUrl) {
      throw new Error('DEPLOYED_VERCEL_URL is not set');
    }
    const response = await fetch(`${baseUrl}/api/google-sheets?sheetName=${sheetName}`, {
      next: { revalidate: revalidateSeconds },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet "${sheetName}": ${response.statusText}`);
    }

    const { data } = (await response.json()) as { data: T[] };

    return data.reduce((map, item) => {
      const key = String(item[keyField]);
      const { [keyField]: _ignored, [valueField]: defaultValue, ...rest } = item;
      map[key] = { ...rest, default: defaultValue };
      return map;
    }, {} as Record<string, MappedSheet<T, KeyField, ValueField>>);
  } catch (error) {
    console.error(`Error fetching sheet "${sheetName}":`, error);
    return {} as Record<string, MappedSheet<T, KeyField, ValueField>>;
  }
}