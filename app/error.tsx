"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="font-display font-semibold text-2xl">Algo salió mal</h1>
      <button className="mt-4 font-semibold text-sm underline" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
