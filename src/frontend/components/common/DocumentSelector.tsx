import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Document type for selector
interface Document {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'indexed' | 'error';
}

/**
 * Document selector component for Chunks tab
 */
const DocumentSelector: React.FC<{
  onNavigateToDocuments: () => void;
}> = ({ onNavigateToDocuments }) => {
  const { selectedDocumentId, setSelectedDocumentId } = useAppStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch('/api/documents');
        const docs: Document[] = await response.json();
        setDocuments(docs);
      } catch {
        // Error handling
      } finally {
        setIsLoading(false);
      }
    };
    loadDocuments();
  }, []);

  const statusVariants = {
    pending: 'pending',
    processing: 'processing',
    indexed: 'indexed',
    error: 'error',
  } as const;

  const statusLabels = {
    pending: '等待中',
    processing: '处理中',
    indexed: '已索引',
    error: '错误',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">选择文档查看分块</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            加载中...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="mb-2">暂无文档</p>
            <Button
              variant="link"
              size="sm"
              onClick={onNavigateToDocuments}
            >
              前往文档管理上传
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <Button
                key={doc.id}
                variant={selectedDocumentId === doc.id ? 'secondary' : 'ghost'}
                className="w-full justify-between"
                onClick={() => setSelectedDocumentId(doc.id)}
              >
                <span className="truncate flex-1">{doc.filename}</span>
                <Badge variant={statusVariants[doc.status]}>
                  {statusLabels[doc.status]}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentSelector;