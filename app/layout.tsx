import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming=await headers();
  const host=incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const localHost=host.includes("localhost") || host.startsWith("127.0.0.1");
  const protocol=incoming.get("x-forwarded-proto") ?? (localHost ? "http" : "https");
  const image=`${protocol}://${host}/og.png`;
  const title="FactoryTrace — PLC Traceability Digital Twin";
  const description="Interactive 3D production-line simulator with vision inspection, barcode validation, automatic reject, OPC UA mapping, and unit-level genealogy.";
  return {
    title, description,
    openGraph:{title,description,type:"website",images:[{url:image,width:1734,height:908,alt:"FactoryTrace PLC traceability digital twin"}]},
    twitter:{card:"summary_large_image",title,description,images:[image]},
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
