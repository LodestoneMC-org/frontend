import { getSnowflakeTimestamp } from './../utils/util';
import { InstanceEvent } from './../bindings/InstanceEvent';
import { match, otherwise } from 'variant';
import { useUserAuthorized } from 'data/UserInfo';
import axios from 'axios';
import { useContext, useEffect, useRef, useState } from 'react';
import { LodestoneContext } from './LodestoneContext';
import { ClientEvent } from 'bindings/ClientEvent';

export type ConsoleStreamStatus =
  | 'no-permission'
  | 'loading'
  | 'buffered'
  | 'live'
  | 'live-no-buffer'
  | 'closed'
  | 'error';

// simplified version of a ClientEvent with just InstanceOutput
export type ConsoleEvent = {
  timestamp: number;
  snowflake_str: string;
  detail: string;
  uuid: string;
  name: string;
  message: string;
};

// function to convert a ClientEvent to a ConsoleEvent
const toConsoleEvent = (event: ClientEvent): ConsoleEvent => {
  const event_inner: InstanceEvent = match(
    event.event_inner,
    otherwise(
      {
        InstanceEvent: (instanceEvent) => instanceEvent,
      },
      () => {
        throw new Error('Expected InstanceEvent');
      }
    )
  );

  const message = match(
    event_inner.instance_event_inner,
    otherwise(
      {
        InstanceOutput: (instanceOutput) => instanceOutput.message,
      },
      () => {
        throw new Error('Expected InstanceOutput');
      }
    )
  );

  return {
    timestamp: getSnowflakeTimestamp(event.snowflake_str),
    snowflake_str: event.snowflake_str,
    detail: event.details,
    uuid: event_inner.instance_uuid,
    name: event_inner.instance_name,
    message: message,
  };
};

/**
 * Does two things:
 * 1. calls useEffect to fetch the console stream
 * 2. calls useEffect to open a websocket connection to the server and subscribe to the console stream
 *   the websocket will update the query cache with new console output
 *
 * Note that we don't use the useQuery hook here and we are managing the query cache manually
 *
 * @param uuid the uuid of the instance to subscribe to
 * @return whatever useQuery returns
 */
export const useConsoleStream = (uuid: string) => {
  const { address, port, apiVersion, isReady, token } =
    useContext(LodestoneContext);
  const [consoleLog, setConsoleLog] = useState<ConsoleEvent[]>([]);
  const [status, setStatusInner] = useState<ConsoleStreamStatus>('loading'); //callbacks should use statusRef.current instead of status
  const statusRef = useRef<ConsoleStreamStatus>('loading');
  statusRef.current = status;
  const setStatus = (newStatus: ConsoleStreamStatus) => {
    statusRef.current = newStatus;
    setStatusInner(newStatus);
  };
  const canAccessConsole = useUserAuthorized('can_access_instance_console', uuid);

  const mergeConsoleLog = (newLog: ClientEvent[]) => {
    setConsoleLog((oldLog) => {
      const consoleEvents = newLog
        .filter((event) => {
          return (
            event.event_inner.type === 'InstanceEvent' &&
            event.event_inner.instance_event_inner.type === 'InstanceOutput'
          );
        })
        .map(toConsoleEvent);

      const mergedLog = [...oldLog, ...consoleEvents];
      // this is slow ik
      return mergedLog.filter(
        (event, index) =>
          mergedLog.findIndex((e) => e.snowflake_str === event.snowflake_str) ===
          index
      );
    });
  };

  useEffect(() => {
    if (!isReady) {
      setStatus('loading');
      return;
    }
    if (!canAccessConsole) {
      setStatus('no-permission');
      return;
    }
    setStatus('loading');

    const websocket = new WebSocket(
      `ws://${address}:${
        port ?? 16662
      }/api/${apiVersion}/instance/${uuid}/console/stream?token=Bearer ${token}`
    );

    websocket.onopen = () => {
      if (statusRef.current === 'loading') setStatus('live-no-buffer');
      if (statusRef.current === 'buffered') setStatus('live');
    };

    websocket.onmessage = (messageEvent) => {
      const event: ClientEvent = JSON.parse(messageEvent.data);
      mergeConsoleLog([event]);
    };

    websocket.onclose = (event) => {
      setStatus(event.code === 1000 ? 'closed' : 'error');
    };

    return () => {
      websocket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, address, port, apiVersion, uuid, canAccessConsole]);

  useEffect(() => {
    if (!isReady) return;
    if (!canAccessConsole) return;
    axios
      .get(`/instance/${uuid}/console/buffer`)
      .then((response) => {
        mergeConsoleLog(response.data);
        if (statusRef.current === 'loading') setStatus('buffered');
        if (statusRef.current === 'live-no-buffer') setStatus('live');
      })
      .catch((e) => {
        console.error(e);
      });
  }, [canAccessConsole, isReady, uuid]);
  return {
    consoleLog,
    consoleStatus: status,
  };
};
