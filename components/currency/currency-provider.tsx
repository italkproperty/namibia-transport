"use client";

import * as React from "react";

import {
  availableCurrencies,
  guessCurrency,
  isCurrencyCode,
  type Currency,
  type CurrencyCode,
  type Rates,
} from "@/lib/currency";

const STORAGE_KEY = "nt-currency";

type CurrencyState = {
  code: CurrencyCode;
  setCode: (code: CurrencyCode) => void;
  rates: Rates;
  options: Currency[];
  /** False until the reader's stored or guessed choice has been applied. */
  ready: boolean;
};

const Context = React.createContext<CurrencyState | null>(null);

/**
 * The reader's currency, chosen once and remembered.
 *
 * Deliberately client-side. Reading a cookie in a server component would opt
 * every page into dynamic rendering, and 160 leg pages plus the guides are
 * static on purpose. So the NAD figure is rendered on the server — it is the
 * amount owed, it is what search engines index, and it is what shows without
 * JavaScript — and the conversion is added afterwards for whoever wants it.
 *
 * `ready` exists so nothing renders a converted figure during the first paint
 * that the stored preference would immediately replace. A price that changes
 * under the reader is worse than a price that arrives a moment late.
 */
export function CurrencyProvider({
  rates,
  children,
}: {
  rates: Rates;
  children: React.ReactNode;
}) {
  const options = React.useMemo(() => availableCurrencies(rates), [rates]);
  const [code, setState] = React.useState<CurrencyCode>("NAD");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let chosen: CurrencyCode | null = null;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isCurrencyCode(stored) && options.some((c) => c.code === stored)) {
        chosen = stored;
      }
    } catch {
      // Private browsing, or storage disabled. Guessing still works.
    }

    chosen ??= guessCurrency(navigator.languages ?? [navigator.language], options);

    if (chosen) setState(chosen);
    setReady(true);
  }, [options]);

  const setCode = React.useCallback((next: CurrencyCode) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Remembering is a convenience; not remembering must not break the page.
    }
  }, []);

  const value = React.useMemo(
    () => ({ code, setCode, rates, options, ready }),
    [code, setCode, rates, options, ready],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Never throws when there is no provider. Prices render inside emails, OG
 * images and tests, and a fare that crashes a page because a context is
 * missing is a worse failure than a fare shown only in NAD.
 */
export function useCurrency(): CurrencyState | null {
  return React.useContext(Context);
}
