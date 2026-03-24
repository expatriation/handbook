import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonIcon,
  IonItem,
  IonList,
  IonRange,
  useIonModal,
} from '@ionic/react';
import { useKeyDetails } from '../keyChip';
import {
  optionsOutline,
  timerOutline,
  addCircleOutline,
  discOutline,
  sunnyOutline,
  folderOutline,
  documentOutline,
} from 'ionicons/icons';
import { AppContext } from '../../utils/appContext';
import { GraphLink, GraphNode } from '../../utils/appTypes';
import Sequence from '../../modals/sequence';
import Assert from '../../modals/assert';

const MAX_TREE_DEPTH = 8;

interface TreeNode {
  node: GraphNode;
  incoming: GraphLink[];
  outgoing: GraphLink[];
  children: TreeNode[];
}

const isValidAbsolutePath = (value?: string) => {
  if (!value || !value.startsWith('/')) {
    return false;
  }

  if (value === '/') {
    return true;
  }

  return !value.includes('\0') && !value.includes('//');
};

const pathLeafName = (value: string) => {
  if (value === '/') {
    return '/';
  }

  const parts = value.split('/').filter(Boolean);
  return parts.at(-1) ?? value;
};

const trimPubkeyDisplay = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue.length > 0 ? trimmedValue : value;
};

const toDisplayPath = (value: string) => {
  const trimmed = trimPubkeyDisplay(value);
  return trimmed || '/';
};

const buildPathSegments = (value: string) => {
  if (!isValidAbsolutePath(value) || value === '/') {
    return [];
  }

  const parts = value.split('/').filter(Boolean);
  let currentPath = '/';

  return parts.map((segment) => {
    currentPath = `${currentPath}${segment}/`;
    return {
      label: segment,
      value: currentPath,
    };
  });
};

function FlowMap({
  forKey,
  setForKey,
  nodes,
  links,
  rankingFilter,
}: {
  forKey: string;
  setForKey: (pk: string) => void;
  nodes: GraphNode[];
  links: GraphLink[];
  rankingFilter: number;
  colorScheme: 'light' | 'dark';
}) {
  const [presentKV] = useKeyDetails(forKey);

  const [presentBlockModal, dismissBlock] = useIonModal(Sequence, {
    onDismiss: (data: string, role: string) => dismissBlock(data, role),
  });

  const [presentPointModal, dismissPoint] = useIonModal(Assert, {
    onDismiss: (data: string, role: string) => dismissPoint(data, role),
    forKey,
  });

  const handleNodeFocus = useCallback(
    (node: GraphNode | null | undefined, clicked: boolean = false) => {
      if (node?.pubkey === forKey && clicked) {
        presentKV({
          initialBreakpoint: 0.75,
          breakpoints: [0, 0.75, 1],
        });
      } else {
        if (node?.id === -1) {
          presentPointModal();
        } else if (node?.pubkey) {
          setForKey(toDisplayPath(node.pubkey));
        }
      }
    },
    [forKey, setForKey, presentKV, presentPointModal],
  );

  const initialNode = useMemo(() => {
    const displayKey = toDisplayPath(forKey);
    const node = nodes.find((n) => toDisplayPath(n.pubkey) === displayKey);
    return node && isValidAbsolutePath(toDisplayPath(node.pubkey)) ? node : null;
  }, [nodes, forKey]);

  useEffect(() => {
    handleNodeFocus(initialNode);
  }, [initialNode, handleNodeFocus]);

  const [present, dismiss] = useIonModal(Filters, {
    onDismiss: () => dismiss(),
    value: rankingFilter,
  });

  const clickableSegments = useMemo(() => {
    return buildPathSegments(toDisplayPath(forKey));
  }, [forKey]);

  const [collapsedToImmediate, setCollapsedToImmediate] = useState(false);

  const [visibleData, setVisibleData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({
    nodes: [],
    links: [],
  });

  const buildTree = useCallback(
    (
      currentNode: GraphNode,
      depth: number,
      path: Set<number>,
      sourceMap: Map<number, GraphLink[]>,
      targetMap: Map<number, GraphLink[]>,
      nodeMap: Map<number, GraphNode>,
    ): TreeNode => {
      const outgoing = sourceMap.get(currentNode.id) ?? [];
      const incoming = targetMap.get(currentNode.id) ?? [];

      if (depth >= MAX_TREE_DEPTH) {
        return {
          node: currentNode,
          outgoing,
          incoming,
          children: [],
        };
      }

      const children = outgoing
        .map((link) => nodeMap.get(link.target))
        .filter((candidate): candidate is GraphNode => {
          return Boolean(candidate && !path.has(candidate.id));
        })
        .map((candidate) => {
          const nextPath = new Set(path);
          nextPath.add(candidate.id);
          return buildTree(
            candidate,
            depth + 1,
            nextPath,
            sourceMap,
            targetMap,
            nodeMap,
          );
        });

      return {
        node: currentNode,
        outgoing,
        incoming,
        children,
      };
    },
    [],
  );

  const rootTree = useMemo(() => {
    if (!initialNode) {
      return null;
    }

    const sourceMap = new Map<number, GraphLink[]>();
    const targetMap = new Map<number, GraphLink[]>();
    const nodeMap = new Map<number, GraphNode>(nodes.map((node) => [node.id, node]));

    for (const link of visibleData.links) {
      sourceMap.set(link.source, [...(sourceMap.get(link.source) ?? []), link]);
      targetMap.set(link.target, [...(targetMap.get(link.target) ?? []), link]);
    }

    return buildTree(
      initialNode,
      0,
      new Set<number>([initialNode.id]),
      sourceMap,
      targetMap,
      nodeMap,
    );
  }, [buildTree, initialNode, nodes, visibleData.links]);

  useEffect(() => {
    if (!initialNode) {
      setVisibleData({ nodes: [], links: [] });
      return;
    }

    const applicableLinks = links.filter((link) => {
      const targetNode = nodes.find((candidate) => candidate.id === link.target);
      return isValidAbsolutePath(targetNode?.pubkey);
    });

    const applicableNodeIds = new Set<number>([
      initialNode.id,
      ...applicableLinks.map((link) => link.source),
      ...applicableLinks.map((link) => link.target),
    ]);

    const applicableNodes = nodes.filter((node) => applicableNodeIds.has(node.id));

    if (collapsedToImmediate) {
      const immediateLinks = applicableLinks.filter(
        (link) => link.source === initialNode.id || link.target === initialNode.id,
      );

      const immediateNodeIds = new Set<number>([
        initialNode.id,
        ...immediateLinks.map((link) => link.source),
        ...immediateLinks.map((link) => link.target),
      ]);

      setVisibleData({
        nodes: applicableNodes.filter((node) => immediateNodeIds.has(node.id)),
        links: immediateLinks,
      });
      return;
    }

    setVisibleData({
      nodes: applicableNodes,
      links: applicableLinks,
    });
  }, [collapsedToImmediate, initialNode, links, nodes]);

  return (
    <IonCard>
      <IonCardHeader className="ion-padding-horizontal">
        <IonCardSubtitle
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              fontFamily: 'monospace, monospace',
              minHeight: '30px',
            }}
          >
            <code style={{ marginRight: 2 }}>/</code>
            {clickableSegments.map((segment, index) => (
              <div
                key={segment.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setForKey(segment.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ion-color-primary)',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  {segment.label}
                </button>
                {index < clickableSegments.length - 1 && <code>/</code>}
              </div>
            ))}
            {clickableSegments.length === 0 && (
              <code style={{ opacity: 0.75 }}>/</code>
            )}
          </div>
        </IonCardSubtitle>
        <IonCardSubtitle className="ion-no-padding">
          <IonButton
            className="ion-no-padding"
            fill="clear"
            onClick={(e) => {
              e.stopPropagation();
              present({
                initialBreakpoint: 0.75,
                breakpoints: [0, 0.75, 1],
              });
            }}
          >
            <IonIcon color="primary" slot="icon-only" icon={optionsOutline} />
            <IonBadge
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                opacity: 0.9,
              }}
              className="ion-no-padding"
              color="danger"
            ></IonBadge>
          </IonButton>
          <IonButton onClick={() => presentBlockModal()} fill="clear">
            <IonIcon
              className="ion-no-padding"
              color="primary"
              slot="icon-only"
              icon={timerOutline}
            />
          </IonButton>
          <IonButton onClick={() => presentPointModal()} fill="clear">
            <IonIcon
              className="ion-no-padding"
              color="primary"
              slot="icon-only"
              icon={addCircleOutline}
            />
          </IonButton>
          <IonButton onClick={() => setCollapsedToImmediate(true)} fill="clear">
            <IonIcon
              className="ion-no-padding"
              color="primary"
              slot="icon-only"
              icon={discOutline}
            />
          </IonButton>
          <IonButton onClick={() => setCollapsedToImmediate(false)} fill="clear">
            <IonIcon
              className="ion-no-padding"
              color="primary"
              slot="icon-only"
              icon={sunnyOutline}
            />
          </IonButton>
        </IonCardSubtitle>
      </IonCardHeader>
      <IonCardContent>
        {!rootTree && <p>No file/folder entries available for this key.</p>}
        {rootTree && (
          <TreeBranch
            branch={rootTree}
            isRoot={true}
            onNodeClick={(node) => handleNodeFocus(node, true)}
            currentKey={forKey}
          />
        )}
      </IonCardContent>
    </IonCard>
  );
}

const TreeBranch = ({
  branch,
  onNodeClick,
  currentKey,
  isRoot = false,
}: {
  branch: TreeNode;
  onNodeClick: (node: GraphNode) => void;
  currentKey: string;
  isRoot?: boolean;
}) => {
  const [expanded, setExpanded] = useState(true);

  const trimmedPubkey = toDisplayPath(branch.node.pubkey);
  const isCurrentNode = toDisplayPath(branch.node.pubkey) === toDisplayPath(currentKey);
  const memoEdges = branch.outgoing.filter((edge) => Boolean(edge.memo?.trim()));
  const hasMemo = Boolean(branch.node.memo?.trim()) || memoEdges.length > 0;
  const hasChildren = branch.children.length > 0;

  return (
    <div
      style={{
        borderLeft: isRoot ? 'none' : '1px solid var(--ion-color-medium)',
        marginLeft: isRoot ? 0 : 8,
        paddingLeft: isRoot ? 0 : 12,
        marginBottom: 8,
      }}
    >
      <IonList inset={true}>
        <IonItem
          button={true}
          detail={true}
          color={isCurrentNode ? 'primary' : undefined}
          onClick={() => onNodeClick(branch.node)}
        >
          <IonIcon
            icon={hasChildren ? folderOutline : documentOutline}
            slot="start"
            color={isCurrentNode ? 'light' : 'medium'}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'hidden',
            }}
          >
            <code>{pathLeafName(trimmedPubkey)}</code>
            <code style={{ opacity: 0.75 }}>{trimmedPubkey}</code>
          </div>
        </IonItem>
        {hasChildren && (
          <IonItem button={true} detail={false} onClick={() => setExpanded((state) => !state)}>
            <code>{expanded ? 'Collapse' : 'Expand'} {branch.children.length}</code>
          </IonItem>
        )}
      </IonList>

      {expanded && hasMemo && (
        <IonList inset={true}>
          <IonItem lines="none">
            <code>memo: {branch.node.memo}</code>
          </IonItem>
          {memoEdges.map((edge, edgeIndex) => (
            <IonItem key={`${branch.node.id}-${edge.target}-${edge.height}-${edgeIndex}`} lines="none">
              <code>memo: {edge.memo}</code>
            </IonItem>
          ))}
        </IonList>
      )}

      {expanded && branch.children.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {branch.children.map((child) => (
            <TreeBranch
              key={`${branch.node.id}-${child.node.id}`}
              branch={child}
              onNodeClick={onNodeClick}
              currentKey={currentKey}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FlowMap;

export const Filters = ({
  onDismiss,
  value,
}: {
  onDismiss: () => void;
  value: number;
}) => {
  const { rankingFilter, setRankingFilter } = useContext(AppContext);

  return (
    <div className="ion-padding">
      <IonList>
        <IonItem>
          <IonRange
            aria-label="Attention filter"
            labelPlacement="start"
            label={`Filter < ${value}%`}
            pin={true}
            pinFormatter={(value: number) => `${value}%`}
            onIonChange={({ detail }) => setRankingFilter(Number(detail.value))}
            value={rankingFilter}
          />
        </IonItem>
      </IonList>
      <IonButton expand="block" onClick={onDismiss}>
        Done
      </IonButton>
    </div>
  );
};
