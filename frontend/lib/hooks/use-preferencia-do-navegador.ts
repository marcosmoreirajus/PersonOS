"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferência guardada no navegador (localStorage ou cookie), lida com
 * `useSyncExternalStore` em vez de `useState` + efeito no mount.
 *
 * O servidor não enxerga o navegador, então o primeiro render usa `servidor`
 * e o React troca pelo valor real logo após hidratar — sem hydration
 * mismatch, e sem o setState em efeito que o lint aponta.
 *
 * Se gravar falhar (storage bloqueado), o valor fica em memória: a escolha
 * vale na sessão, só não persiste.
 */
export function criarPreferenciaDoNavegador<T>({
  ler,
  gravar,
  servidor,
}: {
  ler: () => T;
  gravar: (valor: T) => void;
  servidor: T;
}) {
  const ouvintes = new Set<() => void>();
  let emMemoria: { valor: T } | null = null;

  function subscribe(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }

  function snapshot(): T {
    if (emMemoria) return emMemoria.valor;
    try {
      return ler();
    } catch {
      return servidor;
    }
  }

  function definir(valor: T) {
    try {
      gravar(valor);
      emMemoria = null;
    } catch {
      emMemoria = { valor };
    }
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  return function usePreferencia(): [T, (valor: T) => void] {
    const valor = useSyncExternalStore(subscribe, snapshot, () => servidor);
    return [valor, definir];
  };
}
