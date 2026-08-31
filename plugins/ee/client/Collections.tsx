import type { ColumnSort } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { CollectionIcon, HiddenIcon } from "outline-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { CollectionPermission } from "@shared/types";
import type Collection from "~/models/Collection";
import { ConditionalFade } from "~/components/Fade";
import Flex from "~/components/Flex";
import { HEADER_HEIGHT } from "~/components/Header";
import Heading from "~/components/Heading";
import InputSearch from "~/components/InputSearch";
import Scene from "~/components/Scene";
import { SortableTable } from "~/components/SortableTable";
import { type Column as TableColumn } from "~/components/Table";
import Text from "~/components/Text";
import Time from "~/components/Time";
import { ActionContextProvider } from "~/hooks/useActionContext";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import usePolicy from "~/hooks/usePolicy";
import useQuery from "~/hooks/useQuery";
import useStores from "~/hooks/useStores";
import { useTableRequest } from "~/hooks/useTableRequest";
import CollectionMenu from "~/menus/CollectionMenu";
import {
  FILTER_HEIGHT,
  StickyFilters,
} from "~/scenes/Settings/components/StickyFilters";

function permissionLabel(collection: Collection, t: (key: string) => string) {
  if (collection.isPrivate || collection.permission === null) {
    return t("Private");
  }
  if (collection.permission === CollectionPermission.ReadWrite) {
    return t("View and edit");
  }
  return t("View only");
}

function CollectionsAdmin() {
  const { t } = useTranslation();
  const team = useCurrentTeam();
  const { collections } = useStores();
  const can = usePolicy(team);
  const history = useHistory();
  const location = useLocation();
  const params = useQuery();
  const [query, setQuery] = useState(params.get("query") || "");

  const reqParams = useMemo(
    () => ({
      query: params.get("query") || undefined,
      sort: params.get("sort") || "name",
      direction: (params.get("direction") || "asc").toUpperCase() as
        | "ASC"
        | "DESC",
      includeListOnly: true,
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
    (fetchParams: {
      offset?: number;
      limit?: number;
      query?: string;
      sort?: string;
      direction?: string;
      includeListOnly?: boolean;
    }) =>
      collections.fetchPage({
        ...fetchParams,
        includeListOnly: true,
      }),
    [collections]
  );

  const rows = useMemo(() => {
    let items = Array.from(collections.data.values()).filter(
      (collection) => !collection.deletedAt
    );
    if (reqParams.query) {
      const q = reqParams.query.toLowerCase();
      items = items.filter((collection) =>
        collection.name.toLowerCase().includes(q)
      );
    }
    return items;
  }, [collections.data, reqParams.query]);

  const { data, error, loading, next } = useTableRequest({
    data: rows,
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
      toast.error(t("Could not load collections"));
    }
  }, [t, error]);

  useEffect(() => {
    const timeout = setTimeout(() => updateParams("query", query), 250);
    return () => clearTimeout(timeout);
  }, [query, updateParams]);

  const columns = useMemo<TableColumn<Collection>[]>(
    () => [
      {
        type: "data",
        id: "name",
        header: t("Name"),
        accessor: (collection) => collection.name,
        component: (collection) => (
          <Flex align="center" gap={8}>
            {collection.isPrivate && <HiddenIcon size={16} />}
            {collection.name}
          </Flex>
        ),
        width: "3fr",
      },
      {
        type: "data",
        id: "permission",
        header: t("Permission"),
        accessor: (collection) => permissionLabel(collection, t),
        component: (collection) => permissionLabel(collection, t),
        sortable: false,
        width: "2fr",
      },
      {
        type: "data",
        id: "sharing",
        header: t("Sharing"),
        accessor: (collection) =>
          collection.sharing ? t("Sharing enabled") : t("Disabled"),
        component: (collection) =>
          collection.sharing ? t("Sharing enabled") : t("Disabled"),
        sortable: false,
        width: "2fr",
      },
      {
        type: "data",
        id: "archivedAt",
        header: t("Date archived"),
        accessor: (collection) => collection.archivedAt || "",
        component: (collection) =>
          collection.archivedAt ? (
            <Time dateTime={collection.archivedAt} addSuffix />
          ) : null,
        width: "2fr",
      },
      {
        type: "action",
        id: "menu",
        width: "40px",
        component: (collection) => (
          <ActionContextProvider value={{ activeModels: [collection] }}>
            <CollectionMenu collection={collection} />
          </ActionContextProvider>
        ),
      },
    ],
    [t]
  );

  return (
    <Scene title={t("Collections")} icon={<CollectionIcon />} wide>
      <Heading>{t("Collections")}</Heading>
      <Text as="p" type="secondary">
        <Trans defaults="Manage the permissions and settings of all collections in the knowledge base. As a workspace admin you can also administer private collections." />
      </Text>
      {can.update && (
        <>
          <StickyFilters>
            <InputSearch
              short
              value={query}
              placeholder={`${t("Filter")}…`}
              onChange={(event) => setQuery(event.target.value)}
            />
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

export default observer(CollectionsAdmin);
