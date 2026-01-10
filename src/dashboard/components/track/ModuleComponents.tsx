import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useAtom } from "jotai";
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
import {
  getRecordingForTrack,
  getSequencerForTrack,
} from "../../../shared/json/recordingUtils";
import {
  resolveTrackTrigger,
  resolveChannelTrigger,
} from "../../../shared/midi/midiUtils";
import { Button } from "../Button";
import { FaPlus } from "react-icons/fa";
import { FaExclamationTriangle } from "react-icons/fa";
import { Tooltip } from "../Tooltip";
import type { Track, InputConfig, UserConfig } from "@/types";

interface Channel {
  name: string;
  number: number;
  sequences: any[];
}

interface SelectedChannel {
  trackIndex: number;
  instanceId: number | string;
  moduleType: string;
  channelNumber: number | string;
  isConstructor: boolean;
}

export interface ModuleSelectorProps {
  trackIndex: number;
  predefinedModules: any[];
  openRightMenu: (trackIndex: number) => void;
  stopPlayback: () => void;
  onShowTrackData: (track: Track) => void;
  inputConfig: InputConfig | null;
}

export const ModuleSelector = React.memo<ModuleSelectorProps>(
  ({
    trackIndex,
    predefinedModules,
    openRightMenu,
    stopPlayback,
    onShowTrackData,
    inputConfig,
  }) => {
    const [userData] = useAtom(userDataAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const tracks = getActiveSetTracks(userData, activeSetId);
    const track = tracks[trackIndex];
    const currentInputType = inputConfig?.type || "midi";
    const globalMappings = userData.config;
    const resolvedTrigger = resolveTrackTrigger(
      track,
      currentInputType,
      globalMappings
    );
    const isSequencerMode = userData.config?.sequencerMode || false;

    return (
      <div className="font-mono flex flex-col justify-between mb-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-neutral-500">
            <span>[TRACK]</span>{" "}
            <span className="">
              {track.name}
              {!isSequencerMode && resolvedTrigger
                ? ` (${resolvedTrigger})`
                : ""}
            </span>
          </span>
        </div>
      </div>
    );
  }
);

ModuleSelector.displayName = "ModuleSelector";

const groupSequences = (sequences: any[], threshold = 0.1) => {
  const grouped: any[] = [];
  let currentGroup: any = null;

  sequences.forEach((seq) => {
    if (
      currentGroup &&
      seq.time <= currentGroup.time + currentGroup.duration + threshold
    ) {
      currentGroup.duration = Math.max(
        currentGroup.duration,
        seq.time + seq.duration - currentGroup.time
      );
    } else {
      currentGroup = { ...seq };
      grouped.push(currentGroup);
    }
  });

  return grouped;
};

export interface NoteSelectorProps {
  trackIndex: number;
  instanceId: string;
  moduleType: string;
  predefinedModules: any[];
  onRemoveModule?: (instanceId: string) => void;
  dragHandleProps?: any;
  inputConfig: InputConfig | null;
  config: UserConfig | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelName: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
}

export const NoteSelector = React.memo<NoteSelectorProps>(
  ({
    trackIndex,
    instanceId,
    moduleType,
    predefinedModules,
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
  }) => {
    const [userData, setUserData] = useAtom(userDataAtom);
    const [recordingData] = useAtom(recordingDataAtom);
    const [selectedChannel, setSelectedChannel] = useAtom(selectedChannelAtom);
    const [flashingChannels] = useAtom(flashingChannelsAtom);
    const [flashingConstructors] = useAtom(flashingConstructorsAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const tracks = getActiveSetTracks(userData, activeSetId);
    const track = tracks[trackIndex];
    const moduleData = track.modulesData[instanceId] || {
      constructor: [],
      methods: {},
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
    const isFileMissing =
      isWorkspaceMode && moduleType && !workspaceFileSet.has(moduleType);
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

    const [channelsData, setChannelsData] = useState<Channel[] | null>(null);

    useEffect(() => {
      const loadChannels = async () => {
        if (track?.channelMappings) {
          const recording = getRecordingForTrack(recordingData, String(track.id));
          const recordingMap = new Map<string, any[]>();
          if (recording?.channels && Array.isArray(recording.channels)) {
            recording.channels.forEach((ch: any) => {
              if (ch && typeof ch === 'object' && 'name' in ch) {
                recordingMap.set(ch.name, (ch as any).sequences || []);
              }
            });
          }

          const channels = Object.keys(track.channelMappings).map(
            (channelNumber) => {
              const channelName = `ch${channelNumber}`;
              return {
                name: channelName,
                number: parseInt(channelNumber),
                sequences: recordingMap.get(channelName) || [],
              };
            }
          );
          setChannelsData(channels);
        } else {
          setChannelsData(null);
        }
      };

      loadChannels();
    }, [track, recordingData, track?.channelMappings]);

    useEffect(() => {
      if (
        !channelsData ||
        !Array.isArray(channelsData) ||
        channelsData.length === 0
      )
        return;
      const channelNumbers = new Set(channelsData.map((c) => String(c.number)));

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const trackDraft = activeSet.tracks[trackIndex];
        if (!trackDraft?.modulesData?.[instanceId]?.methods) return;
        const methods = trackDraft.modulesData[instanceId].methods;
        Object.keys(methods).forEach((channelKey) => {
          if (!channelNumbers.has(channelKey)) {
            delete methods[channelKey];
          }
        });
      });
    }, [channelsData, setUserData, trackIndex, instanceId, activeSetId]);

    const channels = useMemo(() => {
      if (!channelsData) return [];

      return [...channelsData].sort((a, b) => {
        return a.number - b.number;
      });
    }, [channelsData]);

    const trackDuration = useMemo(() => {
      if (!channelsData || channelsData.length === 0) return 60;

      const maxTime = Math.max(
        ...channelsData.flatMap(
          (ch) => ch.sequences?.map((seq) => seq.time + seq.duration) || [0]
        ),
        60
      );

      return maxTime;
    }, [channelsData]);

    const toggleSelectChannel = useCallback(
      (channelNumber: number | string, isConstructor = false) => {
        const isSelected =
          selectedChannel &&
          selectedChannel.trackIndex === trackIndex &&
          selectedChannel.instanceId === instanceId &&
          selectedChannel.channelNumber === channelNumber &&
          selectedChannel.isConstructor === isConstructor;

        const setSelectedChannelFn = setSelectedChannel as any;
        setSelectedChannelFn?.(
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

    const visualizeConstructor = useCallback(
      (containerRef: SVGSVGElement, trackDuration: number, moduleData: any) => {
        const svg = d3.select(containerRef);
        svg.selectAll("*").remove();

        const width = containerRef.parentElement?.getBoundingClientRect().width || 0;
        const heightPerChannel = rowHeight - 1;

        const svgElement = svg
          .attr("width", width)
          .attr("height", heightPerChannel)
          .append("g");

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
      },
      []
    );

    const visualizeChannel = useCallback(
      (channel: Channel, containerRef: SVGSVGElement, trackDuration: number, moduleData: any) => {
        const svg = d3.select(containerRef);
        svg.selectAll("*").remove();

        if (!channel.sequences || channel.sequences.length === 0) {
          return;
        }

        const width = containerRef.parentElement?.getBoundingClientRect().width || 0;
        const heightPerChannel = rowHeight - 1;
        const x = d3.scaleLinear().domain([0, trackDuration]).range([0, width]);

        const svgElement = svg
          .attr("width", width)
          .attr("height", heightPerChannel)
          .append("g");

        const g = svgElement.append("g");

        const line = d3
          .line<any>()
          .x((d) => x(d.time))
          .y(() => heightPerChannel / 2)
          .curve(d3.curveLinear);

        const groupedSequences = groupSequences(channel.sequences);
        const channelKey = String(channel.number);
        const hasMethods = (moduleData.methods[channelKey] as any)?.length > 0;

        g.selectAll("path")
          .data(groupedSequences)
          .enter()
          .append("path")
          .attr("d", (d) =>
            line([{ time: d.time }, { time: d.time + d.duration }])
          )
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
      },
      []
    );

    return (
      <div className="px-12 font-mono">
        <div className="mb-2 flex flex-wrap items-center justify-between">
          <span className="text-neutral-500 text-sm">
            <span>[MODULE]</span> {moduleType}
            {moduleWarningText ? (
              <span className="ml-2 inline-flex items-center">
                <Tooltip content={moduleWarningText} position="top">
                  <span className="text-red-500/70 text-[11px] cursor-help">
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
                {...dragHandleProps}
              >
                <span className="text-md text-neutral-300">{"\u2261 "}</span>
              </span>
            )}
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
            <div
              className={`flex items-center p-0 ${
                isConstructorSelected ? "bg-white/5" : "bg-transparent"
              }`}
            >
              <div
                className={`uppercase w-[140px] pr-4 text-[11px] flex items-center gap-2 cursor-pointer ${
                  flashingConstructors.has(`${track.id}:${instanceId}`)
                    ? "text-red-500"
                    : isConstructorSelected
                    ? "text-neutral-300"
                    : "text-neutral-300"
                }`}
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
                  ref={(ref) =>
                    ref && visualizeConstructor(ref, trackDuration, moduleData)
                  }
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
                selectedChannel.channelNumber === String(channel.number) &&
                !selectedChannel.isConstructor;

              const hasMethods = (moduleData.methods[channelKey] as any)?.length > 0;
              const isFlashing = flashingChannels.has(channelKey);

              return (
                <div
                  key={channel.number}
                  className={`uppercase flex items-center p-0 ${
                    isSelected ? "bg-white/5" : "bg-transparent"
                  }`}
                >
                  <div
                    className={`w-[140px] pr-4 text-[11px] font-mono flex items-center gap-2 cursor-pointer ${
                      isFlashing
                        ? "text-red-500"
                        : isSelected
                        ? "text-neutral-300"
                        : "text-neutral-300"
                    }`}
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
                        userData.config
                      );
                      return resolvedChannelTrigger
                        ? `Channel ${channel.number} (${resolvedChannelTrigger})`
                        : `Channel ${channel.number}`;
                    })()}
                  </div>
                  <div className="flex-1">
                    {config?.sequencerMode ? (
                      <div
                        className="flex gap-0.5 items-center"
                        style={{ height: rowHeight }}
                      >
                        {Array.from({ length: 16 }).map((_, stepIndex) => {
                          const channelKey = String(channel.number);
                          const sequencerData = getSequencerForTrack(
                            recordingData,
                            String(track.id)
                          );
                          const channelPattern =
                            sequencerData.pattern?.[channelKey] || [];
                          const isActive =
                            Array.isArray(channelPattern) &&
                            channelPattern.includes(stepIndex);
                          const isCurrentStep =
                            isSequencerPlaying &&
                            sequencerCurrentStep === stepIndex;

                          return (
                            <button
                              key={stepIndex}
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
                                ${
                                  isCurrentStep ? "ring-2 ring-neutral-400" : ""
                                }
                              `}
                              style={{
                                opacity: isActive && !hasMethods ? 0.2 : 1,
                              }}
                              title={`Channel ${channel.number} - Step ${
                                stepIndex + 1
                              }`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <svg
                        ref={(ref) =>
                          ref &&
                          visualizeChannel(
                            channel,
                            ref,
                            trackDuration,
                            moduleData
                          )
                        }
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

NoteSelector.displayName = "NoteSelector";

export interface SortableModuleItemProps {
  id: string;
  moduleInstance: {
    id: string;
    type: string;
  };
  trackIndex: number;
  predefinedModules: any[];
  onRemoveModule?: (instanceId: string) => void;
  inputConfig: InputConfig | null;
  config: UserConfig | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelName: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
}

export const SortableModuleItem = React.memo<SortableModuleItemProps>(
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
  }) => {
    return (
      <SortableWrapper id={id}>
        {({ dragHandleProps, isDragging }) => (
          <div className="flex flex-col overflow-auto h-full">
            <div className="w-full">
              <NoteSelector
                trackIndex={trackIndex}
                instanceId={moduleInstance.id}
                moduleType={moduleInstance.type}
                predefinedModules={predefinedModules}
                onRemoveModule={onRemoveModule}
                dragHandleProps={dragHandleProps}
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

SortableModuleItem.displayName = "SortableModuleItem";
