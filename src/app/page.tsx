import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Auto Doc
        </h1>
        <p className="text-lg text-gray-600 max-w-md">
          AI-powered document generation platform
        </p>
        <Link
          href="/admin/doc-gen"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Open Document Generator
        </Link>
      </div>
    </div>
  );
}
