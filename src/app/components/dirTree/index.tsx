import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonCardHeader,
  IonCardSubtitle,
  IonButtons,
  IonHeader,
  IonItem,
  IonList,
  IonModal,
  IonToolbar,
  IonPage,
  IonText,
  IonTitle,
  IonIcon,
} from '@ionic/react';
import { documentTextOutline, linkOutline, logoYoutube } from 'ionicons/icons';
import { GraphLink, GraphNode } from '../../utils/appTypes';

const MAX_TREE_DEPTH = 8;

interface TreeNode {
  node: GraphNode;
  incoming: GraphLink[];
  outgoing: GraphLink[];
  children: TreeNode[];
}

type MemoContent =
  | { type: 'youtube'; videoId: string }
  | { type: 'url'; url: string }
  | { type: 'text'; text: string };

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

const getYouTubeVideoId = (value?: string) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const shortId = url.pathname.split('/').filter(Boolean)[0];
      return shortId && /^[\w-]{11}$/.test(shortId) ? shortId : null;
    }

    if (!host.endsWith('youtube.com')) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'shorts' || segments[0] === 'embed') {
      const embeddedId = segments[1];
      return embeddedId && /^[\w-]{11}$/.test(embeddedId) ? embeddedId : null;
    }

    const watchId = url.searchParams.get('v');
    return watchId && /^[\w-]{11}$/.test(watchId) ? watchId : null;
  } catch {
    return null;
  }
};

const getMemoContent = (memo?: string): MemoContent | null => {
  const trimmedMemo = memo?.trim();
  if (!trimmedMemo) {
    return null;
  }

  const youtubeVideoId = getYouTubeVideoId(trimmedMemo);
  if (youtubeVideoId) {
    return {
      type: 'youtube',
      videoId: youtubeVideoId,
    };
  }

  try {
    const parsedUrl = new URL(trimmedMemo);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return {
        type: 'url',
        url: parsedUrl.toString(),
      };
    }
  } catch {
    // fall back to plain text rendering
  }

  return {
    type: 'text',
    text: trimmedMemo,
  };
};

const getMemoIcon = (memoContent: MemoContent | null) => {
  if (!memoContent) {
    return null;
  }

  if (memoContent.type === 'youtube') {
    return logoYoutube;
  }

  if (memoContent.type === 'url') {
    return linkOutline;
  }

  return documentTextOutline;
};

const MemoModal = ({
  onDismiss,
  content,
}: {
  onDismiss: () => void;
  content: MemoContent;
}) => {
  const renderMemoContent = () => {
    if (content.type === 'youtube') {
      return (
        <div style={{ position: 'relative', width: '100%', paddingBottom: '177.78%' }}>
          <iframe
            title="Memo YouTube short"
            src={`https://www.youtube.com/embed/${content.videoId}?autoplay=1&playsinline=1`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      );
    }

    if (content.type === 'url') {
      return (
        <iframe
          title="Memo web content"
          src={content.url}
          style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 8 }}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      );
    }

    return (
      <IonText>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content.text}</p>
      </IonText>
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton color="medium" onClick={() => onDismiss()}>
              Close
            </IonButton>
          </IonButtons>
          <IonTitle>Memo</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardContent>{renderMemoContent()}</IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

function DirTree({
  forKey,
  setForKey,
  nodes,
  links,
}: {
  forKey: string;
  setForKey: (pk: string) => void;
  nodes: GraphNode[];
  links: GraphLink[];
  colorScheme: 'light' | 'dark';
}) {

  const handleNodeFocus = useCallback(
    (node: GraphNode | null | undefined) => {
      if (node?.pubkey) {
          setForKey(toDisplayPath(node.pubkey));
        }
    },
    [setForKey],
  );

  const initialNode = useMemo(() => {
    const displayKey = toDisplayPath(forKey);
    const node = nodes.find((n) => toDisplayPath(n.pubkey) === displayKey);
    return node && isValidAbsolutePath(toDisplayPath(node.pubkey)) ? node : null;
  }, [nodes, forKey]);

  useEffect(() => {
    handleNodeFocus(initialNode);
  }, [initialNode, handleNodeFocus]);

  const clickableSegments = useMemo(() => {
    return buildPathSegments(toDisplayPath(forKey));
  }, [forKey]);

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

    setVisibleData({
      nodes: applicableNodes,
      links: applicableLinks,
    });
  }, [initialNode, links, nodes]);

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
      </IonCardHeader>
      <IonCardContent>
        {!rootTree && <p>No entries available for this key.</p>}
        {rootTree && (
          <TreeBranch
            branch={rootTree}
            isRoot={true}
            onNodeClick={(node) => handleNodeFocus(node)}
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

  const trimmedPubkey = toDisplayPath(branch.node.pubkey);
  const isCurrentNode = toDisplayPath(branch.node.pubkey) === toDisplayPath(currentKey);
  const [activeMemo, setActiveMemo] = useState<MemoContent | null>(null);
  const memoContent = getMemoContent(branch.node.memo);
  const memoIcon = getMemoIcon(memoContent);
  const isCurrentNodeWithoutMemo = isCurrentNode && !memoContent;
  const isNodeButtonEnabled = !isCurrentNodeWithoutMemo;

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
          button={isNodeButtonEnabled}
          detail={true}
          disabled={!isNodeButtonEnabled}
          color={isCurrentNode ? 'primary' : undefined}
          onClick={() => {
            if (!isNodeButtonEnabled) {
              return;
            }
            if (isCurrentNode && memoContent) {
              setActiveMemo(memoContent);
              return;
            }
            onNodeClick(branch.node);
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'hidden',
            }}
          >
            <code style={{ opacity: 0.75 }}>{pathLeafName(trimmedPubkey)}</code>
          </div>
          {isCurrentNode && memoIcon && (
            <IonIcon
              slot="end"
              icon={memoIcon}
              aria-label={`Memo ${memoContent?.type ?? 'content'} icon`}
            />
          )}
        </IonItem>
      </IonList>

      {branch.children.length > 0 && (
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

      <IonModal isOpen={Boolean(activeMemo)} onDidDismiss={() => setActiveMemo(null)}>
        {activeMemo && (
          <MemoModal
            onDismiss={() => setActiveMemo(null)}
            content={activeMemo}
          />
        )}
      </IonModal>
    </div>
  );
};

export default DirTree;
