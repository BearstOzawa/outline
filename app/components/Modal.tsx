import * as Dialog from "@radix-ui/react-dialog";
import { observer } from "mobx-react";
import { CloseIcon, BackIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import breakpoint from "styled-components-breakpoint";
import { depths, s, borderRadius } from "@shared/styles";
import Flex from "~/components/Flex";
import NudeButton from "~/components/NudeButton";
import Scrollable from "~/components/Scrollable";
import Text from "~/components/Text";
import useMobile from "~/hooks/useMobile";
import usePrevious from "~/hooks/usePrevious";
import { fadeAndScaleIn, fadeIn } from "~/styles/animations";
import Desktop from "~/utils/Desktop";
import ErrorBoundary from "./ErrorBoundary";
import Tooltip from "./Tooltip";
import { useDialogContext } from "~/components/DialogContext";

const ModalSidePanelContext = React.createContext<
  (node: React.ReactNode | null) => void
>(() => undefined);

/** Render a panel attached to the left of the current modal window. */
export function useModalSidePanel(node: React.ReactNode | null) {
  const setSidePanel = React.useContext(ModalSidePanelContext);

  React.useEffect(() => {
    setSidePanel(node);
    return () => setSidePanel(null);
  }, [node, setSidePanel]);
}

type Props = {
  children?: React.ReactNode;
  isOpen: boolean;
  title?: React.ReactNode;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  onRequestClose: () => void;
};

const Modal: React.FC<Props> = ({
  children,
  isOpen,
  title,
  style,
  width,
  height,
  onRequestClose,
}: Props) => {
  const wasOpen = usePrevious(isOpen);
  const isMobile = useMobile();
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("Untitled");
  const dialog = useDialogContext();
  const [sidePanel, setSidePanel] = React.useState<React.ReactNode | null>(
    null
  );

  const onClose = React.useCallback(() => {
    dialog.setAnimating(false); // Reset
    onRequestClose();
  }, [dialog, onRequestClose]);

  if (!isOpen && !wasOpen) {
    return null;
  }

  return (
    <ModalSidePanelContext.Provider value={setSidePanel}>
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <StyledOverlay />
        <StyledContent
          onEscapeKeyDown={onClose}
          onPointerDownOutside={onClose}
          aria-describedby={undefined}
        >
          {isMobile ? (
            <Mobile>
              {sidePanel ? <SidePanel $flush>{sidePanel}</SidePanel> : null}
              <MobileContent>
                <Centered onClick={(ev) => ev.stopPropagation()} column>
                  <Dialog.Title asChild>
                    <Text size="xlarge" weight="bold">
                      {resolvedTitle}
                    </Text>
                  </Dialog.Title>
                  <ErrorBoundary>{children}</ErrorBoundary>
                </Centered>
              </MobileContent>
              <Close onClick={onClose}>
                <CloseIcon size={32} />
              </Close>
              <Back onClick={onClose}>
                <BackIcon size={32} />
                <Text>{t("Back")} </Text>
              </Back>
            </Mobile>
          ) : (
            <Wrapper $width={width} $height={height}>
              {sidePanel ? <SidePanel>{sidePanel}</SidePanel> : null}
              <Centered
                $fill={!!height}
                onClick={(ev) => ev.stopPropagation()}
                // maxHeight needed for proper overflow behavior in Safari
                style={
                  height
                    ? { height: "100%", maxHeight: "none" }
                    : { maxHeight: "65vh" }
                }
                column
                reverse
              >
                <DesktopContent
                  style={style}
                  $fill={!!height}
                  flex={!!height}
                  topShadow={!height}
                  overflow={
                    height ? "hidden" : dialog.animating ? "hidden" : undefined
                  }
                  onAnimationEnd={() => dialog.setAnimating(false)}
                >
                  <ErrorBoundary component="div">{children}</ErrorBoundary>
                </DesktopContent>
                <Header>
                  <Dialog.Title asChild>
                    <Text size="large">{resolvedTitle}</Text>
                  </Dialog.Title>
                  <Tooltip content={t("Close")} shortcut="Esc">
                    <NudeButton onClick={onClose} aria-label={t("Close")}>
                      <CloseIcon />
                    </NudeButton>
                  </Tooltip>
                </Header>
              </Centered>
            </Wrapper>
          )}
        </StyledContent>
      </Dialog.Portal>
    </Dialog.Root>
    </ModalSidePanelContext.Provider>
  );
};

const StyledOverlay = styled(Dialog.Overlay)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${(props) => props.theme.modalBackdrop} !important;
  z-index: ${depths.overlay};
  animation: ${fadeIn} 200ms ease;
`;

const StyledContent = styled(Dialog.Content)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${depths.modal};
  display: flex;
  justify-content: center;
  align-items: flex-start;
  outline: none;
`;

const Mobile = styled.div`
  animation: ${fadeAndScaleIn} 250ms ease;

  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${depths.modal};
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: ${s("background")};
  outline: none;
`;

const MobileContent = styled(Scrollable)`
  width: 100%;
  padding: 8vh 12px;

  ${breakpoint("tablet")`
    padding: 13vh 2rem 2rem;
  `};
`;

const DesktopContent = styled(Scrollable)<{ $fill?: boolean }>`
  padding: 8px 24px 24px;
  ${(props) =>
    props.$fill &&
    `
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  `}
`;

const Centered = styled(Flex)<{ $fill?: boolean }>`
  width: 640px;
  max-width: 100%;
  position: relative;
  margin: 0 auto;
  ${(props) =>
    props.$fill &&
    `
    flex: 1;
    min-height: 0;
    height: 100%;
  `}
`;

const Close = styled(NudeButton)`
  position: absolute;
  display: block;
  top: 0;
  right: 0;
  margin: 12px;
  opacity: 0.75;
  color: ${s("text")};
  width: auto;
  height: auto;

  &:hover {
    opacity: 1;
  }

  ${breakpoint("tablet")`
    display: none;
  `};
`;

const Back = styled(NudeButton)`
  position: absolute;
  display: none;
  align-items: center;
  top: ${Desktop.hasInsetTitlebar() ? "3rem" : "2rem"};
  left: 2rem;
  opacity: 0.75;
  color: ${s("text")};
  font-weight: 500;
  width: auto;
  height: auto;

  &:hover {
    opacity: 1;
  }

  ${breakpoint("tablet")`
    display: flex;
  `};
`;

const Header = styled(Flex)`
  color: ${s("textSecondary")};
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  padding: 24px 24px 12px;
  flex-shrink: 0;
  gap: 8px;

  // Allows a long title to wrap or truncate instead of pushing out the close
  // button
  > :first-child {
    min-width: 0;
  }

  > :last-child {
    flex-shrink: 0;
  }
`;

const SidePanel = styled.div<{ $flush?: boolean }>`
  position: absolute;
  top: 0;
  bottom: 0;
  right: ${(props) => (props.$flush ? "auto" : "100%")};
  left: ${(props) => (props.$flush ? "0" : "auto")};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: auto;
  min-height: 0;
  background: transparent;
  overflow: visible;
  z-index: 1;
`;

const Wrapper = styled.div<{
  $width?: number | string;
  $height?: number | string;
}>`
  animation: ${fadeAndScaleIn} 250ms ease;

  position: relative;
  margin: ${(props) => (props.$height ? "auto" : "25vh auto auto auto")};
  width: 75vw;
  min-width: 350px;
  max-width: ${(props) => props.$width || "450px"};
  height: ${(props) => props.$height || "auto"};
  max-height: ${(props) => props.$height || "70vh"};
  z-index: ${depths.modal};
  display: flex;
  flex-direction: column;
  justify-content: ${(props) => (props.$height ? "stretch" : "center")};
  align-items: stretch;
  background: ${s("modalBackground")};
  box-shadow: ${s("modalShadow")};
  ${borderRadius(10)}
  outline: none;
  overflow: visible;

  ${NudeButton} {
    &:hover,
    &[aria-expanded="true"] {
      background: ${s("sidebarControlHoverBackground")};
    }
    vertical-align: middle;
  }

  ${Header} {
    align-items: start;
  }
`;

export default observer(Modal);
