import { NextResponse } from "next/server";
import { parseCSV } from "@/utils/parseCSV";

export async function GET(request: Request) {

    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get("sheetName") || "";

    const baseUrl = process.env.SHEETS_URL;

    const sheetId = process.env[`${sheetName.toUpperCase()}_SHEETS_ID`] || "";

    if (sheetName && !sheetId) {
        return NextResponse.json(
            { error: `Missing ${sheetName} config.` },
            { status: 500 }
        );
    }

    if (!baseUrl) {
        return NextResponse.json(
            { error: "Missing SHEETS_URL environment variable." },
            { status: 500 }
        );
    }

    let url = `${baseUrl}?output=csv`;
    if (sheetId) {
        url += `&gid=${sheetId}`;
    }

    try {
        const res = await fetch(url, {
            next: {
                revalidate: 60
            }
        });
        if (!res.ok) {
            return NextResponse.json(
                { error: `Failed to fetch CSV data. HTTP status: ${res.status}` },
                { status: res.status }
            );
        }

        const csvText = await res.text();

        const data = parseCSV(csvText);
        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
    }
}