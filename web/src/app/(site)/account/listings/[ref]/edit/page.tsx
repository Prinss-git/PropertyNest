import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/listingForm/ListingForm";
import type { FormValues } from "@/lib/listingDefaults";
import { requireUser } from "@/lib/auth";
import { getCityOptions } from "@/lib/listings";
import { getListingForEdit } from "@/lib/myListings";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

const str = (n: number | null) => (n === null || n === undefined ? "" : String(n));

export default async function EditListingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await requireUser({ next: `/account/listings/${ref}/edit` });
  const [l, cities] = await Promise.all([getListingForEdit(user, ref), getCityOptions()]);
  if (!l) notFound();
  if (l.status === "CLOSED" || l.status === "ARCHIVED") {
    return (
      <main className="container" style={{ paddingBlock: 48 }}>
        <div className="empty"><h3>This listing is closed</h3><p>Closed and archived listings can&apos;t be edited. Post a new listing instead.</p>
          <Link className="btn btn-outline" href="/account">Back to my account</Link></div>
      </main>
    );
  }

  const v = l.values;
  const initial: FormValues = {
    mode: v.mode as FormValues["mode"],
    type: v.type as FormValues["type"],
    title: v.title,
    description: v.description,
    price: String(v.price),
    cityId: v.cityId,
    areaName: v.areaName,
    address: v.address,
    bedrooms: str(v.bedrooms),
    bathrooms: str(v.bathrooms),
    floorArea: str(v.floorArea),
    lotArea: str(v.lotArea),
    parking: str(v.parking),
    furnishing: v.furnishing,
    amenities: v.amenities,
    terms: v.terms as FormValues["terms"],
    lat: v.lat,
    lng: v.lng,
    showExactLocation: v.showExactLocation,
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/account">Account</Link> / {l.ref} / Edit</div>
          <h1>Edit {l.ref}</h1>
          {l.status === "REJECTED" && l.rejectionReason && (
            <div className="notice" style={{ marginTop: 12 }}>A moderator asked for changes: {l.rejectionReason}</div>
          )}
        </div>
      </div>
      <main className="container">
        <ListingForm cities={cities} initial={initial} initialPhotos={l.photos} editRef={l.ref} />
      </main>
    </>
  );
}
