// ChatWindow usage example demonstrating modern design patterns

import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import ConfidenceBadge from './chat/ConfidenceBadge';
import SourceCard from './chat/SourceCard';
import StreamingIndicator from './chat/StreamingIndicator';

/**
 * Example: ChatWindow with modern design
 *
 * Key patterns:
 * - Use Card for message containers
 * - Use Badge with semantic variants for confidence
 * - Use ScrollArea for scrollable content
 * - Use semantic colors (text-foreground, bg-muted, etc.)
 */

const ChatWindowExample = () => {
  return (
    <div className="bg-card rounded-lg shadow h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            智能问答
          </h2>
          <Button variant="ghost" size="sm">
            清空历史
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 min-h-[300px] max-h-[700px]">
        {/* Messages content */}
      </ScrollArea>

      {/* Input */}
      <form className="p-4 border-t">
        <div className="flex gap-2">
          <Input placeholder="输入问题..." />
          <Button>发送</Button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindowExample;