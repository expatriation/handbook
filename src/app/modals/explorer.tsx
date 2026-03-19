import { PageShell } from '../components/pageShell';
import { useAgent } from '../useCases/useAgent';
import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../utils/appContext';
import Flow from '../components/flow';
import { IonIcon, useIonModal } from '@ionic/react';
import { terminalOutline } from 'ionicons/icons';
import WebsocketConsole from './websocketConsole';

const Context = () => {
  const { selectedKey } = useAgent();

  const { colorScheme, graph, requestGraph, rankingFilter } =
    useContext(AppContext);
  const [presentSocketConsole, dismissSocketConsole] = useIonModal(
    WebsocketConsole,
    {
      onDismiss: () => dismissSocketConsole(),
    },
  );

  const [peekGraphKey, setPeekGraphKey] = useState<string | null | undefined>();

  const whichKey =
    peekGraphKey ||
    selectedKey ||
    '0000000000000000000000000000000000000000000=';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (whichKey) {
        requestGraph(whichKey);
      }
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [whichKey, requestGraph]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (whichKey && data.detail) {
        requestGraph(whichKey);
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
