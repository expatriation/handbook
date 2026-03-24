import { PageShell } from '../components/pageShell';
import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../utils/appContext';
import Flow from '../components/flow';
import { IonIcon, useIonModal } from '@ionic/react';
import { terminalOutline } from 'ionicons/icons';
import WebsocketConsole from './websocketConsole';

const toDisplayPath = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue || '/';
};

const toRequestPath = (value: string) => {
  const displayPath = toDisplayPath(value);
  const normalized = displayPath === '/' ? displayPath : `${displayPath.replace(/\/+$/g, '')}/`;
  return `${normalized.padEnd(43, '0')}=`;
};

const Context = () => {
  const { colorScheme, graph, requestGraph, rankingFilter } =
    useContext(AppContext);
  const [presentSocketConsole, dismissSocketConsole] = useIonModal(
    WebsocketConsole,
    {
      onDismiss: () => dismissSocketConsole(),
    },
  );

  const [peekGraphKey, setPeekGraphKey] = useState<string>('/');
  const whichKey = useMemo(() => toDisplayPath(peekGraphKey), [peekGraphKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (whichKey) {
        requestGraph(toRequestPath(whichKey));
      }
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [whichKey, requestGraph]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (whichKey && data.detail) {
        requestGraph(toRequestPath(whichKey));
      }
    };

    document.addEventListener('inv_block', resultHandler);

    return () => {
      document.removeEventListener('inv_block', resultHandler);
    };
  }, [whichKey, requestGraph]);

  return (
    <PageShell
      tools={[
        {
          label: 'WebSocket console',
          renderIcon: () => <IonIcon slot="icon-only" icon={terminalOutline} />,
          action: () => presentSocketConsole(),
        },
      ]}
      renderBody={() => (
        <>
          {!!whichKey && (
            <>
              {!!graph && (
                <Flow
                  forKey={whichKey}
                  nodes={graph.nodes ?? []}
                  links={graph.links ?? []}
                  setForKey={setPeekGraphKey}
                  rankingFilter={rankingFilter}
                  colorScheme={colorScheme}
                />
              )}
            </>
          )}
        </>
      )}
    />
  );
};

export default Context;
