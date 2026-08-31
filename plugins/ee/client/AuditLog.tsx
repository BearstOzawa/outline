import type { ColumnSort } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { PadlockIcon } from "outline-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { EventHelper } from "@shared/utils/EventHelper";
import { eventLabel } from "@shared/utils/eventLabel";
import FilterOptions from "~/components/FilterOptions";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import InputSearch from "~/components/InputSearch";
import Scene from "~/components/Scene";
import UserFilter from "~/scenes/Search/components/UserFilter";
import Text from "~/components/Text";
import Time from "~/components/Time";
import { ConditionalFade } from "~/components/Fade";
import { SortableTable } from "~/components/SortableTable";
import { type Column as TableColumn } from "~/components/Table";
import { PAGINATION_SYMBOL } from "~/stores/base/Store";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import usePolicy from "~/hooks/usePolicy";
import useQuery from "~/hooks/useQuery";
import { useTableRequest } from "~/hooks/useTableRequest";
import { client } from "~/utils/ApiClient";
import { StickyFilters } from "~/scenes/Settings/components/StickyFilters";
import { HEADER_HEIGHT } from "~/components/Header";
import { FILTER_HEIGHT } from "~/scenes/Settings/components/StickyFilters";

type AuditEvent = {
  id: string;
  name: string;
  actorIpAddress?: string;
  createdAt: string;
  actor?: { id: string; name: string };
};

function AuditLog() {
  const { t } = useTranslation();
  const team = useCurrentTeam();
  const can = usePolicy(team);
  const params = useQuery();
  const history = useHistory();
  const location = useLocation();
  const [query, setQuery] = useState(params.get("query") || "");
  const [rows, setRows] = useState<AuditEvent[]>([]);

  const reqParams = useMemo(
    () => ({
      query: params.get("query") || undefined,
      sort: params.get("sort") || "createdAt",
      direction: (params.get("direction") || "desc").toUpperCase() as
        | "ASC"
        | "DESC",
      auditLog: true,
      actorId: params.get("actorId") || undefined,
      name: params.get("name") || undefined,
    }),
    [params]
  );

  const sort: ColumnSort = useMemo(
    () => ({
      id: reqParams.sort,
      desc: reqParams.direction === "DESC",
    }),
    [reqParams.sort, reqParams.direction]
  );

  const fetchPage = useCallback(
    async (fetchParams: {
      offset?: number;
      limit?: number;
      query?: string;
      sort?: string;
      direction?: string;
      auditLog?: boolean;
      actorId?: string;
      name?: string;
    }) => {
      const res = await client.post("/events.list", {
        auditLog: true,
        sort: fetchParams.sort,
        direction: fetchParams.direction,
        offset: fetchParams.offset,
        limit: fetchParams.limit,
        actorId: fetchParams.actorId,
        name: fetchParams.name,
      });
      const page = ((res.data as AuditEvent[]) ?? []) as AuditEvent[] & {
        [key: symbol]: unknown;
      };
      setRows((prev) => (fetchParams.offset ? [...prev, ...page] : page));
      page[PAGINATION_SYMBOL] = res.pagination;
      return page;
    },
    []
  );

  const filtered = useMemo(() => {
    if (!reqParams.query) {
      return rows;
    }
    const q = reqParams.query.toLowerCase();
    return rows.filter((event) => {
      const label = eventLabel(event.name, t).toLowerCase();
      return (
        event.name.toLowerCase().includes(q) ||
        label.includes(q) ||
        event.actor?.name.toLowerCase().includes(q) ||
        event.actorIpAddress?.includes(q)
      );
    });
  }, [rows, reqParams.query, t]);

  const { data, error, loading, next } = useTableRequest({
    data: filtered,
    sort,
    reqFn: fetchPage,
    reqParams,
  });

  const updateParams = useCallback(
    (name: string, value: string) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      history.replace({
        pathname: location.pathname,
        search: params.toString(),
      });
    },
    [params, history, location.pathname]
  );

  useEffect(() => {
    if (error) {
      toast.error(t("Could not load events"));
    }
  }, [t, error]);

  useEffect(() => {
    const timeout = setTimeout(() => updateParams("query", query), 250);
    return () => clearTimeout(timeout);
  }, [query, updateParams]);

  const columns = useMemo<TableColumn<AuditEvent>[]>(
    () => [
      {
        type: "data",
        id: "actor",
        header: t("Actor"),
        accessor: (event) => event.actor?.name || t("Unknown"),
        component: (event) => event.actor?.name || t("Unknown"),
        sortable: false,
        width: "2fr",
      },
      {
        type: "data",
        id: "name",
        header: t("Event"),
        accessor: (event) => eventLabel(event.name, t),
        component: (event) => eventLabel(event.name, t),
        width: "3fr",
      },
      {
        type: "data",
        id: "createdAt",
        header: t("Timestamp"),
        accessor: (event) => event.createdAt,
        component: (event) => (
          <Time dateTime={event.createdAt} addSuffix />
        ),
        width: "2fr",
      },
      {
        type: "data",
        id: "actorIpAddress",
        header: t("IP address"),
        accessor: (event) => event.actorIpAddress || "",
        component: (event) => event.actorIpAddress || "—",
        sortable: false,
        width: "2fr",
      },
    ],
    [t]
  );

  return (
    <Scene title={t("Audit Log")} icon={<PadlockIcon />} wide>
      <Heading>{t("Audit Log")}</Heading>
      <Text as="p" type="secondary">
        <Trans defaults="The audit log details the history of security related and other events across your knowledge base." />
      </Text>
      {can.audit && (
        <>
          <StickyFilters>
            <Flex gap={8} align="center" wrap>
              <InputSearch
                short
                value={query}
                placeholder={`${t("Filter")}…`}
                onChange={(event) => setQuery(event.target.value)}
              />
              <UserFilter
                userId={reqParams.actorId}
                anyLabel={t("All users")}
                onSelect={(actorId) => updateParams("actorId", actorId || "")}
              />
              <FilterOptions
                defaultLabel={t("Event")}
                selectedKeys={[reqParams.name]}
                onSelect={(name) => updateParams("name", name || "")}
                showFilter
                options={[
                  {
                    key: "",
                    label: t("Event"),
                  },
                  ...EventHelper.AUDIT_EVENTS.map((eventName) => ({
                    key: eventName,
                    label: eventLabel(eventName, t),
                  })),
                ]}
              />
            </Flex>
          </StickyFilters>
          <ConditionalFade animate={!data}>
            <SortableTable
              data={data ?? []}
              columns={columns}
              sort={sort}
              loading={loading}
              rowHeight={50}
              stickyOffset={HEADER_HEIGHT + FILTER_HEIGHT}
              page={{
                hasNext: !!next,
                fetchNext: next,
              }}
            />
          </ConditionalFade>
        </>
      )}
    </Scene>
  );
}

export default observer(AuditLog);
