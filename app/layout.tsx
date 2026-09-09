import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Корчма — Farkle', description: 'Гра в кості. Спробуй удачу проти суперників корчми або зіграй удвох на одному пристрої.' };
export default function RootLayout({children}: {children: React.ReactNode}) {return <html lang="uk"><body>{children}</body></html>}
