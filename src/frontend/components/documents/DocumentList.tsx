import React from 'react';
import { Trash2, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import StatusBadge from '../common/StatusBadge';
import type { Document } from '../../store';

interface DocumentListProps {
  documents: Document[];
  deleteConfirm: string | null;
  onDelete: (id: string) => void;
  onNavigateToChunks?: (documentId: string) => void;
  setSelectedDocumentId: (id: string) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  deleteConfirm,
  onDelete,
  onNavigateToChunks,
  setSelectedDocumentId,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <Card key={doc.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground truncate">
                  {doc.filename}
                </span>
                <StatusBadge status={doc.status} />
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
              </div>
              {doc.errorMessage && (
                <div className="text-sm text-destructive mt-1">
                  {doc.errorMessage}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              {/* View chunks button */}
              {doc.status === 'indexed' && onNavigateToChunks && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDocumentId(doc.id);
                    onNavigateToChunks(doc.id);
                  }}
                  aria-label={`查看 ${doc.filename} 的分块结构`}
                >
                  <Layers className="w-4 h-4" aria-hidden="true" />
                  查看分块
                </Button>
              )}

              <Button
                variant={deleteConfirm === doc.id ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => onDelete(doc.id)}
                aria-label={deleteConfirm === doc.id ? `确认删除 ${doc.filename}` : `删除 ${doc.filename}`}
                aria-pressed={deleteConfirm === doc.id}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {deleteConfirm === doc.id ? '确认删除？' : '删除'}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default DocumentList;