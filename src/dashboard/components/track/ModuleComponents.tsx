import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { useAtom, type PrimitiveAtom } from "jotai";
import * as d3 from "d3";
import { SortableWrapper } from "../../shared/SortableWrapper";
import {
  userDataAtom,
  recordingDataAtom,
  activeSetIdAtom,
  selectedChannelAtom,
  flashingChannelsAtom,
  flashingConstructorsAtom,
} from "../../core/state";
import { updateActiveSet } from "../../core/utils";
import { TERMINAL_STYLES } from "../../core/constants";
import { getActiveSetTracks } from "../../../shared/utils/setUtils";
import { getRecordingForTrack, getSequencerForTrack } from "../../../shared/json/recordingUtils";
import {
  resolveTrackTrigger,
  resolveChannelTrigger,
  parsePitchClass,
  pitchClassToName,
} from "../../../shared/midi/midiUtils";
import { FaExclamationTriangle, FaEye, FaEyeSlash } from "react-icons/fa";
import { Tooltip } from "../Tooltip";

type Track = {
  id: string | number;
  name: string;
  channelMappings?: Record<string, unknown>;
  modulesData: Record<string, { constructor?: unknown[]; methods?: Record<string, unknown[]> }>;
};

type SelectedChannel = {
  trackIndex: number;
  instanceId: string;
  channelNumber: number | "constructor";
  isConstructor: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

type ModuleSelectorProps = {
  trackIndex: number;
  predefinedModules: unknown[];
  openRightMenu: (trackIndex: number) => void;
  stopPlayback: () => void;
  onShowTrackData: (track: unknown) => void;
  inputConfig: { type?: string } | null;
};

export const ModuleSelector = memo(
  ({
    trackIndex,
    inputConfig,
  }: ModuleSelectorProps) => {
    const [userData] = useAtom(userDataAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const tracks = getActiveSetTracks(userData, activeSetId) as unknown as Track[];
    const track = tracks[trackIndex] as Track;
    const currentInputType = inputConfig?.type || "midi";
    const globalMappings = userData.config || {};
    const resolvedTrigger = resolveTrackTrigger(track, currentInputType, globalMappings);
    const resolvedNoteName = useMemo(() => {
      if (currentInputType !== "midi") return resolvedTrigger;
      if (resolvedTrigger === "" || resolvedTrigger === null || resolvedTrigger === undefined) {
        return resolvedTrigger;
      }
      const pc = typeof resolvedTrigger === "number" ? resolvedTrigger : parsePitchClass(resolvedTrigger);
      if (pc === null) return resolvedTrigger;
      const name = pitchClassToName(pc);
      return name || String(pc);
    }, [resolvedTrigger, currentInputType]);
    const isSequencerMode = userData.config?.sequencerMode || false;

    return (
      <div className="font-mono flex flex-col justify-between mb-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-neutral-500">
            <span>[TRACK]</span>{" "}
            <span className="">
              {track.name}
              {!isSequencerMode &&
              resolvedNoteName !== "" &&
              resolvedNoteName !== null &&
              resolvedNoteName !== undefined ? (
                <>
                  {" "}
                  [<span className="text-blue-500">{String(resolvedNoteName)}</span>]
                </>
              ) : (
                ""
              )}
            </span>
          </span>
        </div>
      </div>
    );
  }
);

const groupSequences = (sequences: Array<{ time: number; duration: number }>, threshold = 0.1) => {
  const grouped: Array<{ time: number; duration: number }> = [];
  let currentGroup: { time: number; duration: number } | null = null;

  sequences.forEach((seq) => {
    if (currentGroup && seq.time <= currentGroup.time + currentGroup.duration + threshold) {
      // Extend the current group
      currentGroup.duration = Math.max(
        currentGroup.duration,
        seq.time + seq.duration - currentGroup.time
      );
    } else {
      // Start a new group
      currentGroup = { ...seq };
      grouped.push(currentGroup);
    }
  });

  return grouped;
};

type NoteSelectorProps = {
  trackIndex: number;
  instanceId: string;
  moduleType: string;
  moduleInstance: { id: string; type: string; disabled?: boolean };
  predefinedModules: unknown[];
  onRemoveModule?: ((instanceId: string) => void) | null;
  dragHandleProps?: Record<string, unknown> | null;
  inputConfig: { type?: string } | null;
  config: Record<string, unknown> | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelKey: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
};

export const NoteSelector = memo(
  ({
    trackIndex,
    instanceId,
    moduleType,
    moduleInstance,
    onRemoveModule,
    dragHandleProps,
    inputConfig,
    config,
    isSequencerPlaying,
    sequencerCurrentStep,
    handleSequencerToggle,
    workspacePath = null,
    workspaceModuleFiles = [],
    workspaceModuleLoadFailures = [],
  }: NoteSelectorProps) => {
    const [userData, setUserData] = useAtom(userDataAtom);
    const [recordingData] = useAtom(recordingDataAtom);
    const [selectedChannelRaw, setSelectedChannel] = useAtom(
      selectedChannelAtom as unknown as PrimitiveAtom<unknown>
    );
    const selectedChannel = selectedChannelRaw as SelectedChannel | null;
    const [flashingChannels] = useAtom(flashingChannelsAtom);
    const [flashingConstructors] = useAtom(flashingConstructorsAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const tracks = getActiveSetTracks(userData, activeSetId) as unknown as Track[];
    const track = tracks[trackIndex] as Track;
    const moduleDataRaw = (track.modulesData || {})[instanceId] || null;
    const moduleData = {
      constructor: Array.isArray(moduleDataRaw?.constructor) ? moduleDataRaw.constructor : [],
      methods: isPlainObject(moduleDataRaw?.methods)
        ? (moduleDataRaw.methods as Record<string, unknown[]>)
        : ({} as Record<string, unknown[]>),
    };
    const rowHeight = 12;

    const globalMappings = userData.config || {};
    const currentInputType = inputConfig?.type || "midi";

    const workspaceFileSet = useMemo(() => {
      return new Set((workspaceModuleFiles || []).filter(Boolean));
    }, [workspaceModuleFiles]);
    const workspaceFailureSet = useMemo(() => {
      return new Set((workspaceModuleLoadFailures || []).filter(Boolean));
    }, [workspaceModuleLoadFailures]);
    const isWorkspaceMode = Boolean(workspacePath);
    const isFileMissing = isWorkspaceMode && moduleType && !workspaceFileSet.has(moduleType);
    const isLoadFailed =
      isWorkspaceMode &&
      moduleType &&
      workspaceFileSet.has(moduleType) &&
      workspaceFailureSet.has(moduleType);
    const moduleWarningText = isFileMissing
      ? `Module "${moduleType}" was referenced by this track but "${moduleType}.js" was not found in your workspace modules folder.`
      : isLoadFailed
        ? `Module "${moduleType}.js" exists in your workspace but failed to load. Fix the module file (syntax/runtime error) and save to retry.`
        : null;

    // State to store the loaded channels data
    const [channelsData, setChannelsData] = useState(null);

    // Effect to load channels data from recording or channelMappings
    useEffect(() => {
      const loadChannels = async () => {
        if (track?.channelMappings) {
          const recording = getRecordingForTrack(recordingData, String(track.id));
          const recordingMap = new Map();
          const channelsRaw = isPlainObject(recording) ? recording.channels : null;
          if (Array.isArray(channelsRaw)) {
            channelsRaw.forEach((ch) => {
              const c = isPlainObject(ch) ? ch : {};
              const name = String(c.name ?? "");
              if (!name) return;
              const seq = Array.isArray(c.sequences) ? c.sequences : [];
              recordingMap.set(name, seq);
            });
          }

          const channels = Object.keys(track.channelMappings).map((channelNumber) => {
            const channelName = `ch${channelNumber}`;
            return {
              name: channelName,
              number: parseInt(channelNumber),
              sequences: recordingMap.get(channelName) || [],
            };
          });
          setChannelsData(channels);
        } else {
          setChannelsData(null);
        }
      };

      loadChannels();
    }, [track, recordingData, track?.channelMappings]);

    // Auto-prune orphaned channel method configs for this module when channels change
    useEffect(() => {
      if (!channelsData || !Array.isArray(channelsData) || channelsData.length === 0) return;
      const channelNumbers = new Set(channelsData.map((c) => String(c.number)));

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        if (!isPlainObject(activeSet)) return;
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const trackDraft = tracksUnknown[trackIndex];
        if (!isPlainObject(trackDraft)) return;
        const modulesDataUnknown = (trackDraft as Record<string, unknown>).modulesData;
        if (!isPlainObject(modulesDataUnknown)) return;
        const mdUnknown = (modulesDataUnknown as Record<string, unknown>)[instanceId];
        if (!isPlainObject(mdUnknown)) return;
        const methodsUnknown = (mdUnknown as Record<string, unknown>).methods;
        if (!isPlainObject(methodsUnknown)) return;
        Object.keys(methodsUnknown).forEach((channelKey) => {
          if (!channelNumbers.has(channelKey)) {
            delete (methodsUnknown as Record<string, unknown>)[channelKey];
          }
        });
      });
    }, [channelsData, setUserData, trackIndex, instanceId, activeSetId]);

    // Create a sorted copy of the channels array
    const channels = useMemo(() => {
      if (!channelsData) return [];

      return [...channelsData].sort((a, b) => {
        return a.number - b.number;
      });
    }, [channelsData]);

    const trackDuration = useMemo(() => {
      if (!channelsData || channelsData.length === 0) return 60;

      const maxTime = Math.max(
        ...channelsData.flatMap((ch) => ch.sequences?.map((seq) => seq.time + seq.duration) || [0]),
        60
      );

      return maxTime;
    }, [channelsData]);

    const toggleSelectChannel = useCallback(
      (channelNumber, isConstructor = false) => {
        const isSelected =
          selectedChannel &&
          selectedChannel.trackIndex === trackIndex &&
          selectedChannel.instanceId === instanceId &&
          selectedChannel.channelNumber === channelNumber &&
          selectedChannel.isConstructor === isConstructor;

        setSelectedChannel(
          isSelected
            ? null
            : {
                trackIndex,
                instanceId,
                moduleType,
                channelNumber,
                isConstructor,
              }
        );
      },
      [selectedChannel, trackIndex, instanceId, moduleType, setSelectedChannel]
    );

    const isConstructorSelected =
      selectedChannel &&
      selectedChannel.trackIndex === trackIndex &&
      selectedChannel.instanceId === instanceId &&
      selectedChannel.channelNumber === "constructor" &&
      selectedChannel.isConstructor === true;

    const visualizeConstructor = useCallback((containerRef, trackDuration, moduleData) => {
      const svg = d3.select(containerRef);
      svg.selectAll("*").remove();

      const width = containerRef.parentElement.getBoundingClientRect().width;
      const heightPerChannel = rowHeight - 1;

      const svgElement = svg.attr("width", width).attr("height", heightPerChannel).append("g");

      const g = svgElement.append("g");

      const hasMethods = moduleData.constructor.length > 0;

      g.append("text")
        .attr("x", 0)
        .attr("y", heightPerChannel / 2)
        .attr("dy", "0.35em")
        .attr("fill", TERMINAL_STYLES.text)
        .attr("fill-opacity", hasMethods ? 1 : 0.2)
        .attr("font-size", `${heightPerChannel * 1.5}px`)
        .attr("font-family", TERMINAL_STYLES.fontFamily)
        .text("\u03C4");

      g.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", heightPerChannel)
        .attr("fill", "transparent");
    }, []);

    const visualizeChannel = useCallback((channel, containerRef, trackDuration, moduleData) => {
      const svg = d3.select(containerRef);
      svg.selectAll("*").remove();

      if (!channel.sequences || channel.sequences.length === 0) {
        return;
      }

      const width = containerRef.parentElement.getBoundingClientRect().width;
      const heightPerChannel = rowHeight - 1;
      const x = d3.scaleLinear().domain([0, trackDuration]).range([0, width]);

      const svgElement = svg.attr("width", width).attr("height", heightPerChannel).append("g");

      const g = svgElement.append("g");

      const line = d3
        .line()
        .x((d) => x(d.time))
        .y(() => heightPerChannel / 2)
        .curve(d3.curveLinear);

      const groupedSequences = groupSequences(channel.sequences);
      const channelKey = String(channel.number);
      const hasMethods = moduleData.methods[channelKey]?.length > 0;

      g.selectAll("path")
        .data(groupedSequences)
        .enter()
        .append("path")
        .attr("d", (d) => line([{ time: d.time }, { time: d.time + d.duration }]))
        .attr("stroke", TERMINAL_STYLES.text)
        .attr("stroke-opacity", hasMethods ? 1 : 0.2)
        .attr("stroke-width", heightPerChannel / 1)
        .attr("fill", "none");

      g.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", heightPerChannel)
        .attr("fill", "transparent");
    }, []);

    const isDisabled = moduleInstance?.disabled === true;
    const toggleDisabled = useCallback(() => {
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        if (!isPlainObject(activeSet)) return;
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const trackDraft = tracksUnknown[trackIndex];
        if (!isPlainObject(trackDraft)) return;
        const modulesUnknown = (trackDraft as Record<string, unknown>).modules;
        if (!Array.isArray(modulesUnknown)) return;
        const module = modulesUnknown.find(
          (m) => isPlainObject(m) && String((m as Record<string, unknown>).id ?? "") === instanceId
        );
        if (!module || !isPlainObject(module)) return;
        if (isDisabled) {
          delete (module as Record<string, unknown>).disabled;
        } else {
          (module as Record<string, unknown>).disabled = true;
        }
      });
    }, [setUserData, activeSetId, trackIndex, instanceId, isDisabled]);
    
    return (
      <div className={`px-12 font-mono ${isDisabled ? "opacity-50" : ""}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between">
          <span
            className={`text-sm ${
              moduleInstance.disabled === true
                ? "text-neutral-500/50 line-through"
                : "text-neutral-500"
            }`}
          >
            <span>[MODULE]</span> {moduleType}
            {moduleWarningText ? (
              <span className="ml-2 inline-flex items-center">
                <Tooltip content={moduleWarningText} position="top">
                  <span
                    className="text-red-500/70 text-[11px] cursor-help"
                    data-testid="workspace-module-warning"
                    data-warning={isLoadFailed ? "load-failed" : isFileMissing ? "missing-file" : "unknown"}
                    data-module-type={moduleType}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        (
                          globalThis as unknown as {
                            nwWrldBridge?: { app?: { openProjectorDevTools?: () => void } };
                          }
                        )?.nwWrldBridge?.app?.openProjectorDevTools?.();
                      } catch {}
                    }}
                  >
                    <FaExclamationTriangle />
                  </span>
                </Tooltip>
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-2">
            {dragHandleProps && (
              <span
                className="text-[11px] font-mono text-neutral-300 cursor-move"
                data-testid="module-drag-handle"
                data-module-instance-id={instanceId}
                data-module-type={moduleType}
                {...dragHandleProps}
              >
                <span className="text-md text-neutral-300">{"\u2261 "}</span>
              </span>
            )}
            <button
              type="button"
              className="cursor-pointer text-[11px] text-neutral-400 hover:text-neutral-300 transition-colors focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleDisabled();
                if (typeof (e as unknown as { detail?: number }).detail === "number" && (e as unknown as { detail?: number }).detail > 0) {
                  e.currentTarget.blur();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.code === "Space") {
                  e.preventDefault();
                }
              }}
              title={isDisabled ? "Enable Module" : "Disable Module"}
              aria-pressed={isDisabled}
              aria-label={isDisabled ? "Enable Module" : "Disable Module"}
              data-testid="module-visibility-toggle"
              data-module-instance-id={instanceId}
            >
              {isDisabled ? <FaEyeSlash /> : <FaEye />}
            </button>
            {onRemoveModule && (
              <div className="flex items-center gap-2">
                <div
                  className="text-red-500/50 cursor-pointer text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveModule(instanceId);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Remove Module"
                >
                  [{"\u00D7"}]
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="">
          <div className="pl-12 flex flex-col gap-0">
            <div className={`flex items-center p-0 ${isConstructorSelected ? "bg-white/5" : "bg-transparent"}`}>
              <div
                className={`uppercase w-[140px] pr-4 text-[11px] flex items-center gap-2 cursor-pointer ${
                  flashingConstructors.has(`${track.id}:${instanceId}`)
                    ? "text-red-500"
                    : isConstructorSelected
                      ? "text-neutral-300"
                      : "text-neutral-300"
                }`}
                data-testid="module-channel-config"
                data-module-instance-id={instanceId}
                data-channel-key="constructor"
                onClick={() => toggleSelectChannel("constructor", true)}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-1 flex-shrink-0 ${
                    moduleData.constructor.length > 0
                      ? "bg-neutral-200 border border-neutral-200"
                      : "bg-transparent border border-neutral-600"
                  }`}
                />
                Constructor
              </div>
              <div className="flex-1">
                <svg
                  ref={(ref) => ref && visualizeConstructor(ref, trackDuration, moduleData)}
                  className="w-full"
                  style={{ height: rowHeight }}
                ></svg>
              </div>
            </div>
            {channels.map((channel) => {
              const channelKey = String(channel.number);
              const isSelected =
                selectedChannel &&
                selectedChannel.trackIndex === trackIndex &&
                selectedChannel.instanceId === instanceId &&
                selectedChannel.channelNumber === channel.number &&
                !selectedChannel.isConstructor;

              const hasMethods = moduleData.methods[channelKey]?.length > 0;
              const isFlashing = flashingChannels.has(channelKey);

              return (
                <div
                  key={channel.number}
                  className={`uppercase flex items-center p-0 ${isSelected ? "bg-white/5" : "bg-transparent"}`}
                >
                  <div
                    className={`w-[140px] pr-4 text-[11px] font-mono flex items-center gap-2 cursor-pointer ${
                      isFlashing ? "text-red-500" : isSelected ? "text-neutral-300" : "text-neutral-300"
                    }`}
                    data-testid="module-channel-config"
                    data-module-instance-id={instanceId}
                    data-channel-key={String(channel.number)}
                    onClick={() => toggleSelectChannel(channel.number, false)}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1 flex-shrink-0 ${
                        hasMethods
                          ? "bg-neutral-200 border border-neutral-200"
                          : "bg-transparent border border-neutral-600"
                      }`}
                    />
                    {(() => {
                      if (config?.sequencerMode) {
                        return `Channel ${channel.number}`;
                      }
                      const resolvedChannelTrigger = resolveChannelTrigger(
                        channel.number,
                        currentInputType,
                        globalMappings
                      );
                      if (
                        resolvedChannelTrigger === "" ||
                        resolvedChannelTrigger === null ||
                        resolvedChannelTrigger === undefined
                      ) {
                        return `Channel ${channel.number}`;
                      }
                      if (currentInputType === "midi") {
                        const noteMatchMode =
                          (() => {
                            const inputRaw = isPlainObject(globalMappings)
                              ? (globalMappings as Record<string, unknown>).input
                              : null;
                            const mode =
                              isPlainObject(inputRaw) && inputRaw.noteMatchMode === "exactNote"
                                ? "exactNote"
                                : "pitchClass";
                            return mode;
                          })();
                        if (noteMatchMode === "exactNote") {
                          const label = String(resolvedChannelTrigger ?? "").trim();
                          return label ? (
                            <span className={isFlashing ? "text-red-500" : "text-blue-500"}>{label}</span>
                          ) : (
                            `Channel ${channel.number}`
                          );
                        }

                        const pc =
                          typeof resolvedChannelTrigger === "number"
                            ? resolvedChannelTrigger
                            : parsePitchClass(resolvedChannelTrigger);
                        const name = pc !== null ? pitchClassToName(pc) : null;
                        return name ? (
                          <span className={isFlashing ? "text-red-500" : "text-blue-500"}>{name}</span>
                        ) : (
                          `Channel ${channel.number}`
                        );
                      }
                      return (
                        <span className={isFlashing ? "text-red-500" : "text-blue-500"}>
                          {String(resolvedChannelTrigger)}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex-1">
                    {config?.sequencerMode ? (
                      <div className="flex gap-0.5 items-center" style={{ height: rowHeight }}>
                        {Array.from({ length: 16 }).map((_, stepIndex) => {
                          const channelKey = String(channel.number);
                          const sequencerData = getSequencerForTrack(recordingData, String(track.id));
                          const patternRaw = isPlainObject(sequencerData)
                            ? (sequencerData as Record<string, unknown>).pattern
                            : null;
                          const pattern = isPlainObject(patternRaw) ? (patternRaw as Record<string, unknown>) : {};
                          const channelPattern = pattern[channelKey] || [];
                          const isActive = Array.isArray(channelPattern) && channelPattern.includes(stepIndex);
                          const isCurrentStep = isSequencerPlaying && sequencerCurrentStep === stepIndex;

                          return (
                            <button
                              key={stepIndex}
                              type="button"
                              data-testid="sequencer-step"
                              data-channel-number={channel.number}
                              data-step-index={stepIndex}
                              aria-pressed={isActive}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSequencerToggle(channelKey, stepIndex);
                              }}
                              className={`
                                w-[22px] h-[11px] border transition-all flex-shrink-0
                                ${
                                  isActive
                                    ? "bg-[#b85c5c] border-[#b85c5c]"
                                    : "bg-[#1a1a1a] border-neutral-700 hover:border-neutral-500"
                                }
                                ${isCurrentStep ? "ring-2 ring-neutral-400" : ""}
                              `}
                              style={{
                                opacity: isActive && !hasMethods ? 0.2 : 1,
                              }}
                              title={`Channel ${channel.number} - Step ${stepIndex + 1}`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <svg
                        ref={(ref) => ref && visualizeChannel(channel, ref, trackDuration, moduleData)}
                        className="w-full"
                        style={{ height: rowHeight }}
                      ></svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

type SortableModuleItemProps = {
  id: string;
  moduleInstance: { id: string; type: string };
  trackIndex: number;
  predefinedModules: unknown[];
  onRemoveModule?: ((instanceId: string) => void) | null;
  inputConfig: { type?: string } | null;
  config: Record<string, unknown> | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelKey: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
};

export const SortableModuleItem = memo(
  ({
    id,
    moduleInstance,
    trackIndex,
    predefinedModules,
    onRemoveModule,
    inputConfig,
    config,
    isSequencerPlaying,
    sequencerCurrentStep,
    handleSequencerToggle,
    workspacePath = null,
    workspaceModuleFiles = [],
    workspaceModuleLoadFailures = [],
  }: SortableModuleItemProps) => {
    return (
      <SortableWrapper id={id}>
        {({ dragHandleProps, isDragging: _isDragging }) => (
          <div className="flex flex-col overflow-auto h-full">
            <div className="w-full">
              <NoteSelector
                trackIndex={trackIndex}
                instanceId={moduleInstance.id}
                moduleType={moduleInstance.type}
                moduleInstance={moduleInstance}
                predefinedModules={predefinedModules}
                onRemoveModule={onRemoveModule}
                dragHandleProps={dragHandleProps as unknown as Record<string, unknown>}
                inputConfig={inputConfig}
                config={config}
                isSequencerPlaying={isSequencerPlaying}
                sequencerCurrentStep={sequencerCurrentStep}
                handleSequencerToggle={handleSequencerToggle}
                workspacePath={workspacePath}
                workspaceModuleFiles={workspaceModuleFiles}
                workspaceModuleLoadFailures={workspaceModuleLoadFailures}
              />
            </div>
          </div>
        )}
      </SortableWrapper>
    );
  }
);

