import { NextResponse } from "next/server";

export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
};

export type ApiEnvelope<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiError };

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiEnvelope<T>>(
    { success: true, data, error: null },
    init,
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json<ApiEnvelope<never>>(
    { success: false, data: null, error: { code, message, fields } },
    { status },
  );
}
