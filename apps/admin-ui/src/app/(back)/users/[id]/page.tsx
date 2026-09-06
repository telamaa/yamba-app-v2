import UserFileView from "@/components/UserFileView";

export default async function UserFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserFileView userId={id} />;
}
