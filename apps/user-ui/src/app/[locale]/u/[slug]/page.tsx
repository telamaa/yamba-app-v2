import { Metadata } from "next";
import UserProfileClient from "./UserProfileClient";

type Params = {
  locale: string;
  slug: string;
};

export async function generateMetadata({
                                         params,
                                       }: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;

  // MVP : metadata simple. Pour SEO complet, on pourra fetcher
  // le user côté server pour avoir le vrai firstName dans le title.
  return {
    title: `Yamba — @${slug}`,
    description: "Profil public sur Yamba",
  };
}

export default async function UserProfilePage({
                                                params,
                                              }: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  return <UserProfileClient slug={slug} />;
}
