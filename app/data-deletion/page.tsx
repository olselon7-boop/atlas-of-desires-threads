export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="deletion">
      <h1>Data deletion request</h1>
      <p>Your request was received.</p>
      {code ? (
        <p>
          Confirmation code: <code>{code}</code>
        </p>
      ) : null}
    </main>
  );
}
