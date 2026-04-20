/**
 * Custom ESLint rule: no-nullable-assignment
 *
 * Detects nullable type assignment errors before TypeScript compiler reports them.
 * Error message includes MCP Tool hint for Agent guidance.
 *
 * Tasks covered:
 * - 3.3: isNullable() type checking helper
 * - 3.4: AssignmentExpression visitor with type checker
 * - 3.5: Error message with MCP Tool hint
 */

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

const TS_ERROR_CODE = 2322;

export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow nullable type assignment without handling',
      recommended: 'strict',
    },
    messages: {
      nullableAssignment: `Type '{{source}}' is not assignable to type '{{target}}'.
💡 Fix: type_fix(${TS_ERROR_CODE})`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // Get TypeScript type checker (requires parserOptions.project in eslint config)
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    return {
      // Detect assignment expressions
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        const tsLeft = parserServices.esTreeNodeToTSNodeMap.get(node.left);
        const tsRight = parserServices.esTreeNodeToTSNodeMap.get(node.right);

        const leftType = checker.getTypeAtLocation(tsLeft);
        const rightType = checker.getTypeAtLocation(tsRight);

        // Check if right type is nullable and left type is not
        if (isNullable(rightType, checker) && !isNullable(leftType, checker)) {
          // Additional check: is assignment actually invalid?
          if (!checker.isTypeAssignableTo(rightType, leftType)) {
            context.report({
              node,
              messageId: 'nullableAssignment',
              data: {
                source: checker.typeToString(rightType),
                target: checker.typeToString(leftType),
              },
            });
          }
        }
      },

      // Detect variable declarations with initializers
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (!node.init) return;

        const tsId = parserServices.esTreeNodeToTSNodeMap.get(node.id);
        const tsInit = parserServices.esTreeNodeToTSNodeMap.get(node.init);

        const idType = checker.getTypeAtLocation(tsId);
        const initType = checker.getTypeAtLocation(tsInit);

        // Check if initializer is nullable and variable type is not
        if (isNullable(initType, checker) && !isNullable(idType, checker)) {
          if (!checker.isTypeAssignableTo(initType, idType)) {
            context.report({
              node,
              messageId: 'nullableAssignment',
              data: {
                source: checker.typeToString(initType),
                target: checker.typeToString(idType),
              },
            });
          }
        }
      },

      // Detect function return type mismatches
      ReturnStatement(node: TSESTree.ReturnStatement) {
        if (!node.argument) return;

        // Get the containing function
        const parentFunc = findParentFunction(node);
        if (!parentFunc) return;

        const tsReturn = parserServices.esTreeNodeToTSNodeMap.get(node.argument);
        const returnType = checker.getTypeAtLocation(tsReturn);

        // Get declared return type from function signature
        const tsFunc = parserServices.esTreeNodeToTSNodeMap.get(parentFunc);
        const funcSignature = checker.getSignatureFromDeclaration(tsFunc);
        if (!funcSignature) return;

        const declaredReturnType = checker.getReturnTypeOfSignature(funcSignature);

        if (isNullable(returnType, checker) && !isNullable(declaredReturnType, checker)) {
          if (!checker.isTypeAssignableTo(returnType, declaredReturnType)) {
            context.report({
              node,
              messageId: 'nullableAssignment',
              data: {
                source: checker.typeToString(returnType),
                target: checker.typeToString(declaredReturnType),
              },
            });
          }
        }
      },
    };
  },
});

/**
 * Check if a type contains null or undefined
 * Task 3.3: isNullable() type checking helper
 */
function isNullable(type: ts.Type, checker: ts.TypeChecker): boolean {
  // Direct null or undefined
  if (type.flags & ts.TypeFlags.Null) return true;
  if (type.flags & ts.TypeFlags.Undefined) return true;

  // Union type - check each constituent
  if (type.flags & ts.TypeFlags.Union) {
    const unionType = type as ts.UnionType;
    return unionType.types.some(t => isNullable(t, checker));
  }

  // Intersection type - check each constituent
  if (type.flags & ts.TypeFlags.Intersection) {
    const intersectionType = type as ts.IntersectionType;
    return intersectionType.types.some(t => isNullable(t, checker));
  }

  // Any or unknown - considered nullable for safety
  if (type.flags & ts.TypeFlags.Any) return true;
  if (type.flags & ts.TypeFlags.Unknown) return true;

  return false;
}

/**
 * Find the parent function node
 */
function findParentFunction(node: TSESTree.Node): TSESTree.FunctionLike | null {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'MethodDefinition'
    ) {
      return current as TSESTree.FunctionLike;
    }
    current = current.parent;
  }
  return null;
}