/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    IComponent,
    IComponentHandle,
    IComponentHandleContext,
    IComponentRouter,
    IRequest,
    IResponse,
} from "@fluidframework/component-core-interfaces";
import { AttachState } from "@fluidframework/container-definitions";
import { generateHandleContextPath } from "@fluidframework/runtime-utils";

export class ComponentHandle<T extends IComponent = IComponent> implements IComponentHandle {
    // This is used to break the recursion while attaching the graph. Also tells the attach state of the graph.
    private graphAttachState: AttachState = AttachState.Detached;
    private bound: Set<IComponentHandle> | undefined;
    public readonly absolutePath: string;

    public get IComponentRouter(): IComponentRouter { return this; }
    public get IComponentHandleContext(): IComponentHandleContext { return this; }
    public get IComponentHandle(): IComponentHandle { return this; }

    public get isAttached(): boolean {
        return this.routeContext.isAttached;
    }

    /**
     * Creates a new ComponentHandle.
     * @param value - The IComponent object this handle is for.
     * @param path - The path to this handle relative to the routeContext.
     * @param routeContext - The parent IComponentHandleContext that has a route to this handle.
     */
    constructor(
        protected readonly value: T,
        public readonly path: string,
        public readonly routeContext: IComponentHandleContext,
    ) {
        this.absolutePath = generateHandleContextPath(path, this.routeContext);
    }

    public async get(): Promise<any> {
        return this.value;
    }

    public attachGraph(): void {
        // If this handle is already in attaching state in the graph or attached, no need to attach again.
        if (this.graphAttachState !== AttachState.Detached) {
            return;
        }
        this.graphAttachState = AttachState.Attaching;
        if (this.bound !== undefined) {
            for (const handle of this.bound) {
                handle.attachGraph();
            }

            this.bound = undefined;
        }
        this.routeContext.attachGraph();
        this.graphAttachState = AttachState.Attached;
    }

    public bind(handle: IComponentHandle) {
        // If the dds is already attached or its graph is already in attaching or attached state,
        // then attach the incoming handle too.
        if (this.isAttached || this.graphAttachState !== AttachState.Detached) {
            handle.attachGraph();
            return;
        }
        if (this.bound === undefined) {
            this.bound = new Set<IComponentHandle>();
        }

        this.bound.add(handle);
    }

    public async request(request: IRequest): Promise<IResponse> {
        if (this.value.IComponentRouter !== undefined) {
            return this.value.IComponentRouter.request(request);
        } else {
            return { status: 404, mimeType: "text/plain", value: `${request.url} not found` };
        }
    }
}
