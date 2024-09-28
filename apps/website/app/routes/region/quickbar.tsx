import { TriangleRightIcon, DownloadIcon, UploadIcon, TrashIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Type } from "esi-store/types";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import TreeView from "react-composable-treeview";
import { PiFolderPlusThin } from "react-icons/pi";
import { BsArrowsCollapse } from "react-icons/bs";
import QuickbarContext from "@contexts/quickbarContext";
import { stringSort } from "utils/main";
import { Link, useNavigate, useParams } from "@remix-run/react";
import { typeIconSrc } from "@components/eveIcon";
import * as Dialog from "@radix-ui/react-dialog";
import * as ContextMenu from "@radix-ui/react-context-menu"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import "@scss/quickbar.scss";
import { usePath } from "@hooks/usePath";


export interface QuickbarProps {
  typeRecord: Record<string, Type>
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

interface QuickbarFolderPorps {
  folderId: string
}

interface QuickbarItemProps {
  typeId: number
}

interface QuickbarDataTransfer {
  type: 'folder'|'item'
  id: string
}


interface QuickbarContextType {
  typeRecord: Record<string, Type>
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

const QuickbarComponentContext = createContext<QuickbarContextType>({
  typeRecord: {},
  treeValue: new Set(),
  onTreeValueChange: () => {}
})


export function Quickbar({ typeRecord, treeValue, onTreeValueChange }: QuickbarProps) {
  const quickbar = useContext(QuickbarContext)
  const rootRef = useRef<HTMLUListElement>(null)
  const isQuickbarEmpty = Object.keys(quickbar.state).length == 1
    && quickbar.state.__root__.types.length == 0
    && quickbar.state.__root__.childFolders.length == 0

  const drop = useCallback((event: React.DragEvent) => {
    const dragData: QuickbarDataTransfer = JSON.parse(
      event.dataTransfer.getData('text')
    )

    if(dragData.type == 'item') {
      quickbar.moveItem(parseInt(dragData.id), '__root__')
    }
    else if(dragData.type == 'folder') {
      quickbar.moveFolder(dragData.id, '__root__')
    }

    rootRef.current?.classList.remove('quickbar--drop')
    event.stopPropagation()
    event.preventDefault()
  }, [quickbar.moveItem])

  const allowDrop = useCallback((event: React.DragEvent) => {
    rootRef.current?.classList.add('quickbar--drop')
    event.preventDefault()
  }, [])

  const preventDrop = useCallback((event: React.DragEvent) => {
    rootRef.current?.classList.remove('quickbar--drop')
    event.preventDefault()
  }, [])

  return (
    <QuickbarComponentContext.Provider value={{ typeRecord, treeValue, onTreeValueChange }}>
      <div className="quickbar">
        <div className="quickbar__header">
          <div className="quickbar__actions">
            <CreateFolderButton />
            <ImportQuickbarButton />
            <ExportQuickbarButton />
            <ClearQuickbarButton />
          </div>
          <div className="quickbar__options">
            <button className="quickbar__button" title="Colse all folders" onClick={() => onTreeValueChange(new Set())}>
              <BsArrowsCollapse className="quickbar__button-icon" />
            </button>
          </div>
        </div>

        {isQuickbarEmpty ? (
          <p className="quickbar__empty">Your quickbar is empty</p>
        ) : (
          <TreeView.Root
            className="quickbar__tree"
            value={treeValue}
            onValueChange={onTreeValueChange}
            onDragEnter={allowDrop}
            onDragOver={allowDrop}
            onDragExit={preventDrop}
            onDragLeave={preventDrop}
            onDrop={drop}
            ref={rootRef}
          >

            {quickbar.state.__root__.childFolders.sort(stringSort()).map(folderId => (
              <QuickbarFolder folderId={folderId} key={folderId} />
            ))}

            {quickbar.state.__root__.types.sort(stringSort(t => typeRecord[t].name)).map(typeId => (
              <QuickbarItem typeId={typeId} key={typeId} />
            ))}

          </TreeView.Root>
        )}
      </div>
    </QuickbarComponentContext.Provider>
  )
}

function QuickbarFolder({ folderId }: QuickbarFolderPorps) {
  const quickbar = useContext(QuickbarContext)
  const { treeValue, onTreeValueChange } = useContext(QuickbarComponentContext)
  const folderName = useRef(quickbar.state[folderId].name)
  const folderRef = useRef<HTMLLIElement>(null)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  const drop = useCallback((event: React.DragEvent) => {
    const dragData: QuickbarDataTransfer = JSON.parse(
      event.dataTransfer.getData('text')
    )

    if(dragData.type == 'item') {
      quickbar.moveItem(parseInt(dragData.id), folderId)
    }
    else if(dragData.type == 'folder') {
      quickbar.moveFolder(dragData.id, folderId)
    }

    onTreeValueChange(new Set([ `folder:${folderId}`, ...treeValue ]))
    folderRef.current?.classList.remove('quickbar-folder--drop')
    event.stopPropagation()
    event.preventDefault()
  }, [folderId, quickbar.moveItem, treeValue, onTreeValueChange, folderRef])

  const allowDrop = useCallback((event: React.DragEvent) => {
    folderRef.current?.classList.add('quickbar-folder--drop')
    event.stopPropagation()
    event.preventDefault()
  }, [folderRef])

  const preventDrop = useCallback((event: React.DragEvent) => {
    folderRef.current?.classList.remove('quickbar-folder--drop')
    event.stopPropagation()
    event.preventDefault()
  }, [folderRef])

  const dragStart = useCallback((event: React.DragEvent) => {
    const dragData: QuickbarDataTransfer = {
      type: 'folder',
      id: folderId
    }
    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    event.dataTransfer.dropEffect = 'move'
    folderRef.current?.classList.add('quickbar-folder--drag')
    event.stopPropagation()
  }, [folderId, folderRef])

  const dragEnd = useCallback((event: React.DragEvent) => {
    folderRef.current?.classList.remove('quickbar-folder--drag')
    event.stopPropagation()
  }, [folderRef])

  return (
    <TreeView.Group
      value={`folder:${folderId}`}
      className="quickbar-folder"
      draggable="true"
      onDrop={drop}
      onDragEnter={allowDrop}
      onDragOver={allowDrop}
      onDragExit={preventDrop}
      onDragLeave={preventDrop}
      onDragStart={dragStart}
      onDragEnd={dragEnd}
      ref={folderRef}
    >
      <Dialog.Root open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <TreeView.Trigger className="quickbar-folder__trigger">
              <TriangleRightIcon className="quickbar-folder__triangle"/>
              <span className="quickbar-folder__label">
                {quickbar.state[folderId].name}
              </span>
            </TreeView.Trigger>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="context-menu">
              
              <Dialog.Trigger asChild>
                <ContextMenu.Item className="context-menu__item">
                  Rename folder
                </ContextMenu.Item>
              </Dialog.Trigger>

              <ContextMenu.Item onClick={() => quickbar.removeFolder(folderId)} className="context-menu__item">
                Delete folder
              </ContextMenu.Item>

            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>

        <Dialog.Portal>
          <Dialog.Overlay className="dialog__overlay" />
          <Dialog.Content className="dialog">
            <div className="dialog__header">
              <Dialog.Title className="dialog__title">Rename folder</Dialog.Title>
              <Dialog.Description className="dialog__description">
                Change foler name
              </Dialog.Description>
            </div>

            <div className="dialog__body">
              <input
                className="dialog__text-input"
                type="text"
                placeholder="folder name"
                defaultValue={folderName.current}
                onChange={e => folderName.current = e.target.value}
                onKeyDown={e => {
                  if(e.key == 'Enter') {
                    quickbar.renameFolder(folderId, folderName.current)
                    setRenameDialogOpen(false)
                  }
                }}
                autoFocus
              />
            </div>

            <div className="dialog__footer">
              <Dialog.Close className="button button--corner-left button--text-center">
                Cancel
              </Dialog.Close>
              <Dialog.Close onClick={() => quickbar.renameFolder(folderId, folderName.current)} className="button button--primary button--corner-right button--text-center">
                Rename folder
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <TreeView.Content className="quickbar-folder__content">

        {quickbar.state[folderId].childFolders.sort(stringSort()).map(folderId => (
          <QuickbarFolder folderId={folderId} key={folderId} />
        ))}

        {quickbar.state[folderId].types.map(typeId => (
          <QuickbarItem typeId={typeId} key={typeId} />
        ))}

      </TreeView.Content>
    </TreeView.Group>
  )
}

function QuickbarItem({ typeId }: QuickbarItemProps) {
  const { typeRecord } = useContext(QuickbarComponentContext)
  const quickbar = useContext(QuickbarContext)
  const navigate = useNavigate()
  const path = usePath()
  const type = typeRecord[typeId]
  const itemRef = useRef<HTMLLIElement>(null)

  const dragImage = useMemo(() => {
    const image = new Image(64, 64)
    image.src = typeIconSrc(typeId)
    return image
  }, [typeId])

  const dragStart = useCallback((event: React.DragEvent) => {
    const dragData: QuickbarDataTransfer = {
      type: 'item',
      id: typeId.toString()
    }
    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    event.dataTransfer.dropEffect = 'move'
    event.dataTransfer.setDragImage(dragImage, 16, 16)
    itemRef.current?.classList.add('quickbar-item--drag')
    event.stopPropagation()
  }, [typeId, dragImage, itemRef])

  const dragEnd = useCallback(() => {
    itemRef.current?.classList.remove('quickbar-item--drag')
  }, [itemRef])

  function handleKeyDown(event: React.KeyboardEvent) {
    if(event.key == 'Enter') {
      navigate(path.setTypeId(type.id))
    }
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <TreeView.Item
          value={`item:${type.id}`}
          className="quickbar-item"
          draggable="true"
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onKeyDown={handleKeyDown}
          ref={itemRef}
        >
          <Link to={path.setTypeId(type.id)} tabIndex={-1} className="quickbar-item__link">
            {type.name}
          </Link>
        </TreeView.Item>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu">

          <ContextMenu.Item onClick={() => quickbar.removeItem(typeId)} className="context-menu__item">
            Remove from quickbar
          </ContextMenu.Item>

        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function CreateFolderButton() {
  const quickbar = useContext(QuickbarContext)
  const name = useRef('')
  const [isOpen, setIsOpen] = useState(false)

  function handleKeydown(event: React.KeyboardEvent) {
    if(event.key != 'Enter') return
    quickbar.createFolder(name.current)
    setIsOpen(false)
    name.current = ''
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger className="quickbar__button" title="Create Folder">
        <PiFolderPlusThin className="quickbar__button-icon" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog__header">
            <Dialog.Title className="dialog__title">New folder name</Dialog.Title>
            <Dialog.Description className="dialog__description">
              Enter the name of the quickbar folder you want to create
            </Dialog.Description>
          </div>

          <div className="dialog__body">
            <input
              className="dialog__text-input"
              type="text"
              placeholder="folder name"
              defaultValue={name.current}
              onChange={e => name.current = e.target.value}
              onKeyDown={handleKeydown}
              autoFocus
            />
          </div>

          <div className="dialog__footer">
            <Dialog.Close className="button button--corner-left button--text-center">
              Cancel
            </Dialog.Close>
            <Dialog.Close onClick={() => quickbar.createFolder(name.current)} className="button button--primary button--corner-right button--text-center">
              Create folder
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ImportQuickbarButton() {
  const quickbar = useContext(QuickbarContext)

  async function importQuickbarFromClipboard() {
    quickbar.importQuickbar(await navigator.clipboard.readText())
  }

  return (
    <DropdownMenu.Root modal>
      <DropdownMenu.Trigger className="quickbar__button" title="Import quickbar">
        <DownloadIcon className="quickbar__button-icon" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" className="dropdown">
          <DropdownMenu.Item onClick={importQuickbarFromClipboard} className="dropdown__item">
            Import quickbar from clipboard
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function ExportQuickbarButton() {
  const quickbar = useContext(QuickbarContext)

  async function exportQuickbar() {
    await navigator.clipboard.writeText(quickbar.exportQuickbar())
  }

  return (
    <DropdownMenu.Root modal>
      <DropdownMenu.Trigger className="quickbar__button" title="Export quickbar">
        <UploadIcon className="quickbar__button-icon" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" className="dropdown">
          <DropdownMenu.Item onClick={exportQuickbar} className="dropdown__item">
            Export quickbar to clipboard
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function ClearQuickbarButton() {
  const quickbar = useContext(QuickbarContext)

  return (
    <Dialog.Root>
      <Dialog.Trigger className="quickbar__button" title="Remove all items from quickbar">
        <TrashIcon className="quickbar__button-icon" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog__header">
            <Dialog.Title className="dialog__title">Clear quickbar</Dialog.Title>
            <Dialog.Description className="dialog__description">
              Remove all items from quickbar
            </Dialog.Description>
          </div>

          <div className="dialog__footer">
            <Dialog.Close autoFocus className="button button--corner-left button--text-center">
              Cancel
            </Dialog.Close>
            <Dialog.Close onClick={() => quickbar.clear()} className="button button--primary button--corner-right button--text-center">
              Clear Quickbar
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
