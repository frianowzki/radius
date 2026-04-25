const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

for (const key of ["localStorage", "sessionStorage"] as const) {
  const current = globalThis[key] as Storage | undefined;
  if (current && typeof current.getItem === "function" && typeof current.setItem === "function") {
    continue;
  }

  Object.defineProperty(globalThis, key, {
    value: createMemoryStorage(),
    configurable: true,
  });
}

export {};
