import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

const AiDocs = () => {
  const { docId } = useParams();
  const [docs, setDocs] = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch document index
    fetch('/api/docs-index.json')
      .then(res => res.json())
      .then(data => {
        setDocs(data.docs || []);
        if (docId) {
          const selected = data.docs.find(d => d.id === docId);
          setCurrentDoc(selected || null);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load docs:', err);
        setLoading(false);
      });
  }, [docId]);

  if (loading) return <div className="p-8 text-white font-mono">Loading documents...</div>;

  if (docId && currentDoc) {
    return (
      <div className="min-h-screen bg-black text-white font-mono">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link to="/ai-docs" className="text-blue-400 hover:text-blue-300 text-sm">
              ← Back to all documents
            </Link>
          </div>
          
          <article className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-2">{currentDoc.title}</h1>
            {currentDoc.description && (
              <p className="text-gray-400 mb-6">{currentDoc.description}</p>
            )}
            <div className="text-xs text-gray-500 mb-8">
              Added: {new Date(currentDoc.added).toLocaleDateString()}
            </div>
            <div dangerouslySetInnerHTML={{ __html: currentDoc.content }} />
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold tracking-tighter">AI Document Repository</h1>
          <p className="text-gray-400 mt-2">Curated guides and resources for AI development</p>
        </header>

        {docs.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-sm">
            <p className="text-gray-400">No documents yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {docs.map(doc => (
              <Link
                key={doc.id}
                to={`/ai-docs/${doc.id}`}
                className="block bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm hover:border-zinc-600 transition-colors"
              >
                <h2 className="text-xl font-bold mb-2">{doc.title}</h2>
                {doc.description && (
                  <p className="text-gray-400 text-sm mb-3">{doc.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Added: {new Date(doc.added).toLocaleDateString()}</span>
                  {doc.tags && doc.tags.length > 0 && (
                    <span className="flex gap-2">
                      {doc.tags.map(tag => (
                        <span key={tag} className="text-blue-400">#{tag}</span>
                      ))}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiDocs;
