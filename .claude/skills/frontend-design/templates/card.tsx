// Card component template
// Use for container elements with consistent styling

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';

interface ExampleCardProps {
  title: string;
  description?: string;
  badge?: { text: string; variant: 'high' | 'medium' | 'low' };
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const ExampleCard: React.FC<ExampleCardProps> = ({
  title,
  description,
  badge,
  children,
  footer,
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
};

export default ExampleCard;