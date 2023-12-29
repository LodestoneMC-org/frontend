import { faCircle, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import { useConsoleStream } from 'data/ConsoleStream';
import { InstanceContext } from 'data/InstanceContext';
import { CommandHistoryContext } from 'data/CommandHistoryContext';
import { useUserAuthorized } from 'data/UserInfo';
import Tooltip from 'rc-tooltip';
import React, { useContext, useEffect } from 'react';
import { useRef, useState } from 'react';
import { usePrevious } from 'utils/hooks';
import { DISABLE_AUTOFILL } from 'utils/util';
import ErrorGraphic from './ErrorGraphic';
import { useDocumentTitle } from 'usehooks-ts';

const autoScrollThreshold = 10;

export default function GameConsole() {
  useDocumentTitle('Instance Console - Lodestone');
  const { selectedInstance: instance } = useContext(InstanceContext);
  if (!instance) throw new Error('No instance selected');
  const uuid = instance.uuid;
  const canAccessConsole = useUserAuthorized(
    'can_access_instance_console',
    uuid
  );
  const { consoleLog, consoleStatus, fetchConsolePage } = useConsoleStream(uuid, undefined);
  const [command, setCommand] = useState('');
  const { commandHistory, appendCommandHistory } = useContext(
    CommandHistoryContext
  );
  const [lastScrollPos, setLastScrollPos] = useState(0);
  const [additionalLogs, setAdditionaLogs] = useState(0);
  const [logsRecentlyIncreased, setLogsRecentlyIncreased] = useState(false);
  const [commandNav, setCommandNav] = useState(commandHistory.length);
  const [initialScroll, setInitialScroll] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const isAtBottom = listRef.current
    ? listRef.current.scrollHeight -
    listRef.current.scrollTop -
    listRef.current.clientHeight <
    autoScrollThreshold
    : false;
  const oldIsAtBottom = usePrevious(isAtBottom);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  // if the user is already at the bottom of the list, scroll to the bottom when new items are added
  // otherwise, don't scroll
  useEffect(() => {
    if (oldIsAtBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleLog]);

  useEffect(() => {
    if (listRef.current && !initialScroll) {
      setInitialScroll(true);
      scrollToBottom();
    }
  })

  const sendCommand = (command: string) => {
    axios({
      method: 'post',
      url: `/instance/${uuid}/console`,
      data: JSON.stringify(command),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    scrollToBottom();
  };

  let consoleStatusMessage = '';
  let consoleStatusColor = 'text-gray-500';
  switch (consoleStatus) {
    case 'no-permission':
      consoleStatusMessage = 'No permission to access console';
      consoleStatusColor = 'text-gray-500';
      break;
    case 'loading':
      consoleStatusMessage = 'Loading console...';
      consoleStatusColor = 'text-gray-500';
      break;
    case 'buffered':
      consoleStatusMessage = 'History messages. No live updates';
      consoleStatusColor = 'text-gray-500';
      break;
    case 'live':
      consoleStatusMessage = 'Console is live';
      consoleStatusColor = 'text-green-200';
      break;
    case 'live-no-buffer':
      consoleStatusMessage =
        'Console is live but failed to fetch history. Your internet connection may be unstable';
      consoleStatusColor = 'text-yellow';
      break;
    case 'closed':
      consoleStatusMessage = 'Console is closed';
      consoleStatusColor = 'text-red-200';
      break;
    case 'error':
      consoleStatusMessage = 'Connection lost or error';
      consoleStatusColor = 'text-red-200';
  }
  // overwrites
  if (instance.state === 'Stopped') {
    consoleStatusMessage = `Instance is ${instance.state.toLowerCase()}`;
    consoleStatusColor = 'text-gray-500';
  }

  let consoleInputMessage = '';
  if (!canAccessConsole || consoleStatus === 'no-permission')
    consoleInputMessage = 'No permission';
  else if (instance.state === 'Stopped')
    consoleInputMessage = `Instance is ${instance.state.toLowerCase()}`;
  else if (consoleStatus === 'closed')
    consoleInputMessage = 'Console is closed';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      setCommandNav((prev) => {
        prev = Math.max(prev - 1, 0);
        setCommand(commandHistory[prev]);
        return prev;
      });
    } else if (event.key === 'ArrowDown') {
      setCommandNav((prev) => {
        prev = Math.min(prev + 1, commandHistory.length - 1);
        setCommand(commandHistory[prev]);
        return prev;
      });
    } else {
      setCommandNav(commandHistory.length);
    }
  };

  return (
    <div className="border-gray-faded/30 relative flex h-full w-full grow flex-col rounded-lg border">
      <Tooltip
        overlay={<span>{consoleStatusMessage}</span>}
        placement="bottom"
        showArrow={false}
        trigger={['hover']}
        mouseEnterDelay={0}
      >
        <FontAwesomeIcon
          icon={faCircle}
          className={`text-small absolute top-0 right-0 select-none p-1.5 ${consoleStatusColor}`}
        />
      </Tooltip>
      {!canAccessConsole || consoleStatus === 'no-permission' ? (
        <ErrorGraphic
          icon={faServer}
          message="You don't have permission to access this console"
          className="border-gray-faded/30 rounded-t-lg border-b"
          iconClassName="text-gray-400"
          messageClassName="text-white/50"
        />
      ) : consoleLog.length === 0 ? (
        <ErrorGraphic
          icon={faServer}
          message="No console messages yet"
          className="border-gray-faded/30 rounded-t-lg border-b"
          iconClassName="text-gray-400"
          messageClassName="text-white/50"
        />
      ) : (
        <ol
          className="border-gray-faded/30 text-small flex h-0 grow flex-col overflow-y-auto whitespace-pre-wrap break-words rounded-t-lg border-b bg-gray-900 py-3 font-mono font-light tracking-tight text-gray-300"
          ref={listRef}
          onScroll={(e: React.SyntheticEvent) => {
            // check that position is close to top
            if (!e.currentTarget || !e.currentTarget.scrollTop || logsRecentlyIncreased) {
              return;
            }
            const prevScrollPos = lastScrollPos;
            setLastScrollPos(e.currentTarget.scrollTop)
            
            const scrollPosDiff = e.currentTarget.scrollTop - prevScrollPos; // should be negative to be considered proper trigger
            const triggerThreshhold = 
              e.currentTarget.scrollTop >= autoScrollThreshold * 15 && 
              e.currentTarget.scrollTop <= autoScrollThreshold * 20; // consider range to factor in scroll speed
            
            if (!triggerThreshhold || scrollPosDiff >= 0 || logsRecentlyIncreased) {
              //allow new logs to be generated again if user scrolls down first
              return;
            }
            fetchConsolePage(consoleLog[0].snowflake as unknown as bigint, additionalLogs + 40);
            setAdditionaLogs(currNumLogs => currNumLogs + 40);
            setLogsRecentlyIncreased(true);

            // debounce log generation
            setTimeout(() => {
              setLogsRecentlyIncreased(false);
            }, 1000)

          }}
        >
          {consoleLog.map((line) => (
            <li
              key={line.snowflake}
              className="px-4 py-[0.125rem] hover:bg-gray-800"
            >
              {line.message}
            </li>
          ))}
        </ol>
      )}
      <div className="text-small font-mono">
        <form
          noValidate
          autoComplete={DISABLE_AUTOFILL}
          onSubmit={(e: React.SyntheticEvent) => {
            e.preventDefault();
            sendCommand(command);
            appendCommandHistory(command);
            setCommandNav((prev) => prev + 1);
            setCommand('');
          }}
        >
          <input
            className="bg-gray-850 w-full rounded-b-lg px-4 py-3 text-gray-300 outline-white/50 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 disabled:placeholder:text-gray-500"
            placeholder={consoleInputMessage || 'Enter command...'}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            id="command"
            type="text"
            disabled={consoleInputMessage !== ''}
            onKeyDown={handleKeyDown}
          />
        </form>
      </div>
    </div>
  );
}
